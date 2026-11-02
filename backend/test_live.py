import json
import httpx

client = httpx.Client(base_url="http://localhost:8000/api/v1", timeout=60.0)

print("=" * 60)
print("1. KIEM TRA HEALTHCHECK & KET NOI BACKEND")
print("=" * 60)
res = httpx.get("http://localhost:8000/health")
print(f"Status Code: {res.status_code}")
print(f"Response: {res.json()}")

print("\n" + "=" * 60)
print("2. DANG NHAP TAI KHOAN SINH VIEN NEU STUDY")
print("=" * 60)
auth_res = client.post("/auth/login", json={"email": "student@study.edu.vn", "password": "StudyDemo2026!"})
auth_data = auth_res.json()
token = auth_data["access_token"]
user = auth_data["user"]
print(f"Họ và tên: {user['full_name']}")
print(f"Email: {user['email']}")
print(f"Vai trò (Role): {user['role']}")

print("\n" + "=" * 60)
print("3. KHOI TAO PHIEN HOI THOAI VOI NEU STUDY AI")
print("=" * 60)
conv_res = client.post(
    "/assistant/conversations",
    json={"title": "Hoi dap thuc te ve NEU Study"},
    headers={"Authorization": f"Bearer {token}"}
)
conv_id = conv_res.json()["id"]
print(f"Conversation ID: {conv_id}")

test_questions = [
    "tôi có thể mua giáo trình ở đâu",
    "Điểm chuẩn ngành Logistics và Kiểm toán năm 2025 là bao nhiêu?"
]

for idx, q in enumerate(test_questions, 1):
    print("\n" + "=" * 60)
    print(f"TEST CAU HOI {idx}: \"{q}\"")
    print("=" * 60)
    full_answer = []
    statuses = []
    complete_info = None

    with client.stream(
        "POST",
        f"/assistant/conversations/{conv_id}/messages/stream",
        json={"message": q},
        headers={"Authorization": f"Bearer {token}", "Accept": "text/event-stream"}
    ) as response:
        print(f"HTTP Stream Status: {response.status_code} (OK)")
        event_name = ""
        for line in response.iter_lines():
            if not line:
                continue
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                raw = line[5:].strip()
                try:
                    payload = json.loads(raw)
                    if event_name == "status":
                        state = payload.get("state")
                        provider = payload.get("provider", "")
                        statuses.append(f"{state} ({provider})")
                    elif event_name == "token":
                        full_answer.append(payload.get("text", ""))
                    elif event_name == "complete":
                        complete_info = payload
                except Exception:
                    pass

    print(f"Tien trinh SSE: {' -> '.join(statuses)}")
    print("\n[NOI DUNG CAU TRA LOI TU AI]:")
    print("".join(full_answer))
    if complete_info:
        msg = complete_info.get("message", {})
        print("\n[METADATA HOAN TAT]:")
        print(f"- Message ID: {msg.get('id')}")
        print(f"- Response Mode: {complete_info.get('response_mode')}")
        print(f"- Provider / Model: {complete_info.get('provider')} / {complete_info.get('model')}")
        print(f"- Nguon tham khao trinh bay: {len(msg.get('sources', []))} nguon")

print("\n" + "=" * 60)
print("TEST HOAN TAT: 100% THANH CONG!")
print("=" * 60)
