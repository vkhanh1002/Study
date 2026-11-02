"""Bounded, streaming adapters for Groq and Gemini (raw HTTP; no SDK retries)."""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ProviderError(Exception):
    provider: str
    status_code: int | None
    code: str
    request_id: str | None = None
    error_kind: str = "provider_error"
    retry_after: float | None = None
    rate_limits: dict[str, str] | None = None
    partial_output: bool = False
    metrics: dict | None = None


@dataclass
class Completion:
    text: str
    provider: str
    model: str
    used_fallback: bool = False
    metrics: dict | None = None


@dataclass
class ProviderChunk:
    text: str = ""
    model: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass
class ProviderStreamEvent:
    event: str
    text: str = ""
    provider: str | None = None
    model: str | None = None
    used_fallback: bool = False
    metrics: dict | None = None


class AIProvider(Protocol):
    name: str
    model: str

    @property
    def configured(self) -> bool: ...

    def stream(self, system: str, history: list[dict], question: str, max_tokens: int,
               timeout_seconds: float) -> AsyncIterator[ProviderChunk]: ...


def _provider_error(provider: str, response: httpx.Response) -> ProviderError:
    code = "http_error"
    message = ""
    try:
        payload = response.json()
        error = payload.get("error", payload)
        candidate = error.get("status") or error.get("code") or error.get("type")
        if candidate:
            code = str(candidate)[:80]
        message = str(error.get("message", "")).lower()
    except (ValueError, AttributeError):
        pass
    request_id = response.headers.get("x-request-id") or response.headers.get("request-id")
    retry_after = None
    raw_retry_after = response.headers.get("retry-after")
    if raw_retry_after:
        try:
            retry_after = max(0.0, float(raw_retry_after))
        except ValueError:
            try:
                retry_after = max(0.0, (parsedate_to_datetime(raw_retry_after) - datetime.now(timezone.utc)).total_seconds())
            except (TypeError, ValueError, OverflowError):
                pass
    error_kind = "provider_error"
    if response.status_code == 429:
        quota_terms = ("quota", "billing", "insufficient", "resource_exhausted", "daily limit")
        error_kind = "quota_exhausted" if any(term in f"{code} {message}".lower() for term in quota_terms) else "rate_limited"
    elif response.status_code in {400, 401, 403, 404}:
        error_kind = "request_or_configuration_error"
    elif response.status_code in {500, 502, 503, 504}:
        error_kind = "temporarily_unavailable"
    rate_limit_headers = {
        key: response.headers[key] for key in (
            "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests",
            "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens",
        ) if key in response.headers
    }
    return ProviderError(provider, response.status_code, code, request_id, error_kind, retry_after,
                         rate_limits=rate_limit_headers)


async def _raise_stream_error(provider: str, response: httpx.Response) -> None:
    await response.aread()
    raise _provider_error(provider, response)


def _int_or_none(value) -> int | None:
    return value if isinstance(value, int) and value >= 0 else None


def _http_timeout(seconds: float) -> httpx.Timeout:
    return httpx.Timeout(max(0.1, seconds), connect=min(2.0, max(0.1, seconds)))


class GeminiProvider:
    name = "gemini"

    @property
    def configured(self) -> bool:
        return bool(settings.gemini_api_key)

    @property
    def model(self) -> str:
        return settings.gemini_model

    async def stream(self, system: str, history: list[dict], question: str, max_tokens: int,
                     timeout_seconds: float) -> AsyncIterator[ProviderChunk]:
        if not self.configured:
            raise ProviderError(self.name, None, "not_configured", error_kind="configuration_error")
        contents = []
        for message in history[-8:]:
            role = "model" if message.get("role") == "assistant" else "user"
            content = str(message.get("content", ""))[:1200]
            if content:
                contents.append({"role": role, "parts": [{"text": content}]})
        contents.append({"role": "user", "parts": [{"text": question[:6000]}]})
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:streamGenerateContent?alt=sse"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "thinkingConfig": {
                    "includeThoughts": False,
                },
            },
        }
        try:
            async with httpx.AsyncClient(timeout=_http_timeout(timeout_seconds)) as client:
                async with client.stream("POST", url,
                                         headers={"x-goog-api-key": settings.gemini_api_key}, json=payload) as response:
                    if response.is_error:
                        await _raise_stream_error(self.name, response)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if not raw or raw == "[DONE]":
                            continue
                        try:
                            item = json.loads(raw)
                            candidates = item.get("candidates", [])
                            candidate = candidates[0] if candidates else {}
                            content = candidate.get("content") or {}
                            parts = content.get("parts") or []
                            for part in parts:
                                if part.get("thought"):
                                    continue
                                text = part.get("text")
                                if text:
                                    yield ProviderChunk(text=text, model=self.model)
                            usage = item.get("usageMetadata") or {}
                            if usage:
                                yield ProviderChunk(
                                    model=self.model,
                                    input_tokens=_int_or_none(usage.get("promptTokenCount")),
                                    output_tokens=_int_or_none(usage.get("candidatesTokenCount")),
                                )
                        except (ValueError, TypeError, IndexError, AttributeError) as exc:
                            raise ProviderError(self.name, response.status_code, "invalid_stream_response",
                                                response.headers.get("x-goog-request-id")) from exc
        except httpx.TimeoutException as exc:
            raise ProviderError(self.name, None, "timeout", error_kind="timeout") from exc
        except httpx.TransportError as exc:
            raise ProviderError(self.name, None, "connection_error", error_kind="connection_error") from exc


class GroqProvider:
    name = "groq"
    _models: list[str] = []
    _models_loaded_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(settings.groq_api_key)

    @property
    def model(self) -> str:
        return settings.groq_model or "openai/gpt-oss-20b"

    async def _available_models(self, timeout_seconds: float) -> list[str]:
        if not self.configured:
            raise ProviderError(self.name, None, "not_configured", error_kind="configuration_error")
        if self._models and time.monotonic() - self._models_loaded_at < 300:
            return self._models
        try:
            # This is only needed on a cold cache; keep discovery from consuming the chat budget.
            async with httpx.AsyncClient(timeout=_http_timeout(min(1.5, timeout_seconds))) as client:
                response = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                )
        except httpx.TimeoutException as exc:
            raise ProviderError(self.name, None, "timeout", error_kind="timeout") from exc
        except httpx.TransportError as exc:
            raise ProviderError(self.name, None, "connection_error", error_kind="connection_error") from exc
        if response.is_error:
            raise _provider_error(self.name, response)
        try:
            models = [str(row["id"]) for row in response.json().get("data", []) if row.get("id")]
        except (TypeError, ValueError, KeyError) as exc:
            raise ProviderError(self.name, response.status_code, "invalid_model_list") from exc
        self._models = models
        self._models_loaded_at = time.monotonic()
        return models

    async def _select_model(self, timeout_seconds: float) -> str:
        available = await self._available_models(timeout_seconds)
        configured = settings.groq_model.strip() if settings.groq_model else ""
        allowed = "openai/gpt-oss-20b"
        if configured == allowed and configured in available:
            return configured
        logger.warning("Configured Groq model unavailable configured_model=%s model_available=%s",
                       configured, allowed in available)
        raise ProviderError(self.name, None, "configured_model_unavailable", error_kind="configuration_error")

    async def stream(self, system: str, history: list[dict], question: str, max_tokens: int,
                     timeout_seconds: float) -> AsyncIterator[ProviderChunk]:
        model = await self._select_model(timeout_seconds)
        messages = [{"role": "system", "content": system}]
        messages.extend(history[-8:])
        messages.append({"role": "user", "content": question[:6000]})
        payload = {
            "model": model,
            "messages": messages,
            "temperature": settings.ai_temperature,
            "max_completion_tokens": max_tokens,
            "reasoning_effort": "low",
            "include_reasoning": False,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        try:
            async with httpx.AsyncClient(timeout=_http_timeout(timeout_seconds)) as client:
                async with client.stream(
                    "POST", "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"}, json=payload,
                ) as response:
                    if response.is_error:
                        await _raise_stream_error(self.name, response)
                    yield ProviderChunk(model=model)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if not raw or raw == "[DONE]":
                            continue
                        try:
                            item = json.loads(raw)
                        except ValueError as exc:
                            raise ProviderError(self.name, response.status_code, "invalid_stream_response",
                                                response.headers.get("x-request-id")) from exc
                        choices = item.get("choices") or []
                        if choices:
                            delta = choices[0].get("delta") or {}
                            # The reasoning field is intentionally ignored; only user-facing content is streamed.
                            text = delta.get("content")
                            if isinstance(text, str) and text:
                                yield ProviderChunk(text=text, model=model)
                        usage = item.get("usage") or {}
                        if usage:
                            yield ProviderChunk(model=model,
                                                input_tokens=_int_or_none(usage.get("prompt_tokens")),
                                                output_tokens=_int_or_none(usage.get("completion_tokens")))
        except httpx.TimeoutException as exc:
            raise ProviderError(self.name, None, "timeout", error_kind="timeout") from exc
        except httpx.TransportError as exc:
            raise ProviderError(self.name, None, "connection_error", error_kind="connection_error") from exc


class AIProviderManager:
    """The only retry/orchestration layer. Adapters use raw HTTPX with no SDK retries."""

    def __init__(self):
        self.providers: dict[str, AIProvider] = {"gemini": GeminiProvider(), "groq": GroqProvider()}

    def status(self) -> dict:
        primary_name = settings.ai_provider.lower().strip()
        primary = self.providers.get(primary_name)
        fallback_name = {"gemini": "groq", "groq": "gemini"}.get(primary_name)
        fallback = self.providers.get(fallback_name) if fallback_name else None
        return {
            "provider": primary_name,
            "model": primary.model if primary else "Không xác định",
            "configured": bool(primary and primary.configured),
            "fallback_provider": fallback_name if fallback and fallback.configured else None,
            "fallback_configured": bool(fallback and fallback.configured),
            "embedding_provider": "none",
            "connection_status": "chưa kiểm tra",
        }

    async def stream(self, system: str, history: list[dict], question: str, *, allow_fallback: bool = True,
                     on_status=None, budget_seconds: float | None = None) -> AsyncIterator[ProviderStreamEvent]:
        started = time.monotonic()
        total_budget = max(0.0, budget_seconds if budget_seconds is not None else settings.ai_total_timeout_seconds)
        deadline = started + total_budget
        primary_name = settings.ai_provider.lower().strip()
        primary = self.providers.get(primary_name)
        if not primary:
            raise ProviderError(primary_name or "unknown", None, "unsupported_provider", error_kind="configuration_error")
        fallback_name = {"gemini": "groq", "groq": "gemini"}.get(primary_name)
        providers = [primary]
        fallback = self.providers.get(fallback_name) if fallback_name else None
        if allow_fallback and fallback and fallback.configured:
            providers.append(fallback)

        errors: list[ProviderError] = []
        retry_count = 0
        attempts = 0
        ttft: float | None = None
        successful_provider_seconds: float | None = None
        for provider_index, provider in enumerate(providers):
            if not provider.configured:
                exc = ProviderError(provider.name, None, "not_configured", error_kind="configuration_error")
                errors.append(exc)
                logger.warning("AI provider unavailable provider=%s code=%s kind=%s", provider.name, exc.code, exc.error_kind)
                if provider_index + 1 < len(providers) and on_status:
                    on_status({"state": "switching", "provider": provider.name,
                               "fallback_provider": providers[provider_index + 1].name, "error_kind": exc.error_kind})
                continue

            has_fallback_reserve = provider_index == 0 and len(providers) > 1
            for attempt in range(2):  # At most one retry for a transient failure.
                remaining = deadline - time.monotonic()
                reserve = min(settings.ai_provider_timeout_seconds, max(0.0, remaining)) if has_fallback_reserve else 0.0
                attempt_timeout = min(settings.ai_provider_timeout_seconds, remaining - reserve)
                if attempt_timeout < 0.5:
                    break
                attempts += 1
                if on_status:
                    on_status({"state": "requesting", "provider": provider.name,
                               "attempt": attempt + 1, "max_attempts": 2})
                attempt_started = time.monotonic()
                output_started = False
                current_model = provider.model
                input_tokens = output_tokens = None
                try:
                    async with asyncio.timeout(attempt_timeout):
                        async for chunk in provider.stream(system, history, question, settings.ai_max_output_tokens,
                                                           attempt_timeout):
                            if chunk.model:
                                current_model = chunk.model
                            if chunk.input_tokens is not None:
                                input_tokens = chunk.input_tokens
                            if chunk.output_tokens is not None:
                                output_tokens = chunk.output_tokens
                            if chunk.text:
                                if ttft is None:
                                    ttft = time.monotonic() - started
                                output_started = True
                                yield ProviderStreamEvent("token", text=chunk.text, provider=provider.name,
                                                          model=current_model, used_fallback=provider_index > 0)
                    if not output_started:
                        raise ProviderError(provider.name, None, "empty_response", error_kind="invalid_response")
                    completed_at = time.monotonic()
                    successful_provider_seconds = completed_at - attempt_started
                    metrics = {
                        "provider_seconds": round(completed_at - started, 3),
                        "successful_provider_seconds": round(successful_provider_seconds, 3),
                        "ttft_seconds": round(ttft, 3) if ttft is not None else None,
                        "generation_seconds": round(max(0.0, completed_at - (started + (ttft or 0.0))), 3),
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "retry_count": retry_count,
                        "attempt_count": attempts,
                        "fallback_count": int(provider_index > 0),
                    }
                    yield ProviderStreamEvent("complete", provider=provider.name, model=current_model,
                                              used_fallback=provider_index > 0, metrics=metrics)
                    return
                except TimeoutError as exc:
                    error = ProviderError(provider.name, None, "timeout", error_kind="timeout",
                                          partial_output=output_started)
                    errors.append(error)
                    exc_to_log = error
                except ProviderError as exc:
                    if output_started:
                        exc.partial_output = True
                    errors.append(exc)
                    exc_to_log = exc
                logger.warning("AI provider request failed provider=%s status=%s code=%s kind=%s request_id=%s rate_limits=%s partial_output=%s",
                               exc_to_log.provider, exc_to_log.status_code, exc_to_log.code, exc_to_log.error_kind,
                               exc_to_log.request_id, exc_to_log.rate_limits, exc_to_log.partial_output)
                if exc_to_log.partial_output:
                    # Never splice a fallback model into output already shown to the user.
                    exc_to_log.metrics = {"provider_seconds": round(time.monotonic() - started, 3),
                                          "ttft_seconds": round(ttft, 3) if ttft is not None else None,
                                          "retry_count": retry_count, "attempt_count": attempts,
                                          "fallback_count": int(provider_index > 0)}
                    raise exc_to_log
                if exc_to_log.status_code in {400, 401, 403, 404}:
                    exc_to_log.metrics = {"provider_seconds": round(time.monotonic() - started, 3),
                                          "retry_count": retry_count, "attempt_count": attempts,
                                          "fallback_count": int(provider_index > 0)}
                    raise exc_to_log
                retryable = (
                    exc_to_log.status_code in {408, 500, 502, 503, 504}
                    or exc_to_log.error_kind in {"timeout", "connection_error"}
                    or (exc_to_log.status_code == 429 and exc_to_log.error_kind == "rate_limited")
                )
                if provider_index == 0 and attempt == 0 and retryable:
                    delay = (exc_to_log.retry_after if exc_to_log.status_code == 429 and exc_to_log.retry_after is not None
                             else settings.ai_retry_delay_seconds + random.uniform(0.0, min(0.12, settings.ai_retry_delay_seconds)))
                    remaining = deadline - time.monotonic()
                    reserve = min(settings.ai_provider_timeout_seconds, max(0.0, remaining)) if has_fallback_reserve else 0.0
                    if remaining - delay - reserve >= 0.5:
                        retry_count += 1
                        if on_status:
                            on_status({"state": "retrying", "provider": provider.name, "attempt": 2,
                                       "max_attempts": 2, "error_kind": exc_to_log.error_kind})
                        logger.info("Retrying AI provider provider=%s next_attempt=2/2 delay_seconds=%.2f kind=%s",
                                    provider.name, delay, exc_to_log.error_kind)
                        await asyncio.sleep(delay)
                        continue
                break

            if provider_index + 1 < len(providers):
                if on_status:
                    on_status({"state": "switching", "provider": provider.name,
                               "fallback_provider": providers[provider_index + 1].name})
                continue
            break

        if errors:
            error = errors[-1]
            error.metrics = {"provider_seconds": round(time.monotonic() - started, 3),
                             "ttft_seconds": round(ttft, 3) if ttft is not None else None,
                             "retry_count": retry_count, "attempt_count": attempts,
                             "fallback_count": int(len(providers) > 1 and attempts > 0 and
                                                   errors[-1].provider == providers[-1].name)}
            raise error
        raise ProviderError(primary_name, None, "request_budget_exhausted", error_kind="timeout")

    async def generate(self, system: str, history: list[dict], question: str, *, allow_fallback: bool = True,
                       on_status=None, budget_seconds: float | None = None) -> Completion:
        output: list[str] = []
        completion: Completion | None = None
        async for event in self.stream(system, history, question, allow_fallback=allow_fallback,
                                       on_status=on_status, budget_seconds=budget_seconds):
            if event.event == "token":
                output.append(event.text)
            elif event.event == "complete":
                completion = Completion("".join(output), event.provider or "", event.model or "",
                                        event.used_fallback, event.metrics)
        if completion is None:
            raise ProviderError(settings.ai_provider, None, "empty_response", error_kind="invalid_response")
        return completion


provider_manager = AIProviderManager()
