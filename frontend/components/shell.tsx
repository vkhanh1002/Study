"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  Bell,
  BookOpen,
  CalendarCheck2,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  Menu,
  Search,
  UsersRound,
  BriefcaseBusiness,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

type NavigationLink = { label: string; href: string; icon: typeof LayoutDashboard };

function getNormalizedRole(userRole?: string | null): "GUEST" | "ADMIN" | "GIANG_VIEN" | "SINH_VIEN" {
  if (!userRole) return "GUEST";
  const r = userRole.toUpperCase();
  if (["ADMIN", "SUPER_ADMIN", "ADMISSION_STAFF", "SUPPORT_STAFF"].includes(r)) return "ADMIN";
  if (["GIANG_VIEN", "LECTURER"].includes(r)) return "GIANG_VIEN";
  if (["SINH_VIEN", "STUDENT"].includes(r)) return "SINH_VIEN";
  return "GUEST";
}

function getNavigationForRole(role: "GUEST" | "ADMIN" | "GIANG_VIEN" | "SINH_VIEN"): { title: string; links: NavigationLink[] }[] {
  if (role === "SINH_VIEN") {
    return [
      { title: "TỔNG QUAN", links: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
      { title: "HỒ SƠ", links: [{ label: "Hồ sơ sinh viên", href: "/profiles", icon: UsersRound }] },
      {
        title: "DỊCH VỤ SINH VIÊN",
        links: [
          { label: "Thủ tục nhập học", href: "/support?tab=checklist", icon: CalendarCheck2 },
          { label: "Đơn trực tuyến", href: "/support?tab=requests", icon: BookOpen },
          { label: "Thời khóa biểu & Lịch thi", href: "/support?tab=schedules", icon: CalendarCheck2 },
          { label: "Cẩm nang sinh viên", href: "/support?tab=handbook", icon: CircleHelp },
        ],
      },
      { title: "KẾ HOẠCH HỌC TẬP", links: [{ label: "Study Planner", href: "/study-planner", icon: CalendarCheck2 }] },
      { title: "AI ASSISTANT", links: [{ label: "Trợ lý NEU Study AI", href: "/assistant", icon: Bot }] },
    ];
  }

  if (role === "GIANG_VIEN") {
    return [
      { title: "TỔNG QUAN", links: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
      {
        title: "HỒ SƠ GIẢNG VIÊN",
        links: [
          { label: "Lý lịch khoa học", href: "/personnel/me", icon: GraduationCap },
          { label: "Văn bằng & Chứng chỉ", href: "/personnel/me?tab=degrees", icon: BookOpen },
          { label: "Hợp đồng lao động", href: "/personnel/me?tab=contracts", icon: BriefcaseBusiness },
          { label: "Nhiệm vụ được giao", href: "/personnel/me?tab=tasks", icon: CalendarCheck2 },
          { label: "Thông báo nhân sự", href: "/personnel/me?tab=news", icon: CircleHelp },
        ],
      },
      { title: "AI ASSISTANT", links: [{ label: "Trợ lý NEU Study AI", href: "/assistant", icon: Bot }] },
    ];
  }

  if (role === "ADMIN") {
    return [
      { title: "TỔNG QUAN", links: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
      { title: "TRUNG TÂM QUẢN TRỊ", links: [{ label: "Quản trị hợp nhất", href: "/admin", icon: LayoutDashboard }] },
      { title: "TUYỂN SINH", links: [{ label: "Quản lý tuyển sinh", href: "/admissions", icon: GraduationCap }] },
      {
        title: "NHÂN SỰ",
        links: [
          { label: "Quản lý nhân sự", href: "/personnel", icon: UserRound },
          { label: "Hồ sơ giảng viên", href: "/personnel/lecturers", icon: GraduationCap },
          { label: "Hồ sơ nhân viên", href: "/personnel/employees", icon: BriefcaseBusiness },
        ],
      },
      {
        title: "HỖ TRỢ NGƯỜI HỌC",
        links: [
          { label: "Quản lý đơn sinh viên", href: "/support?tab=requests", icon: BookOpen },
          { label: "Trung tâm hỗ trợ", href: "/support", icon: CircleHelp },
        ],
      },
      {
        title: "AI ASSISTANT",
        links: [
          { label: "Trợ lý NEU Study AI", href: "/assistant", icon: Bot },
          { label: "Kho tri thức AI", href: "/admin?tab=kb", icon: BookOpen },
        ],
      },
    ];
  }

  // Khách / Thí sinh chưa đăng nhập
  return [
    { title: "TỔNG QUAN", links: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }] },
    { title: "TUYỂN SINH", links: [{ label: "Cổng tuyển sinh & Tra cứu", href: "/admissions", icon: GraduationCap }] },
    { title: "GIẢNG VIÊN", links: [{ label: "Đội ngũ giảng viên", href: "/admissions?tab=lecturers", icon: UsersRound }] },
    { title: "HỖ TRỢ", links: [{ label: "Cẩm nang & Tra cứu website", href: "/support", icon: CircleHelp }] },
    { title: "AI ASSISTANT", links: [{ label: "Trợ lý NEU Study AI", href: "/assistant", icon: Bot }] },
  ];
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; message: string; href: string; read_at: string | null; created_at: string }[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const normalizedRole = getNormalizedRole(user?.role);
  const visibleNavigation = useMemo(() => getNavigationForRole(normalizedRole), [normalizedRole]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    let live = true;
    const refresh = () =>
      api<{ items: typeof notifications; unread_count: number }>("/notifications")
        .then((result) => {
          if (live) {
            setNotifications(result.items);
            setUnreadCount(result.unread_count);
          }
        })
        .catch(() => {});
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    setActiveDropdown(null);
  }, [pathname]);

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/admissions?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="app-shell">
      {/* Top Header with Brand, Horizontal Nav, Search & Actions */}
      <header className="topbar">
        <div className="topbar-main">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
              <Menu size={22} />
            </button>

            <Link href="/" className="brand">
              <div className="brand-mark">
                <GraduationCap size={20} strokeWidth={2.3} />
              </div>
              <div className="brand-name">
                <strong>
                  NEU Study<span>.</span>
                </strong>
                <small>UNIVERSITY PLATFORM</small>
              </div>
            </Link>
          </div>

          {/* Desktop Horizontal Navigation */}
          <nav className="desktop-top-nav" aria-label="Menu chính">
            {visibleNavigation.map((group) => {
              if (group.links.length === 1) {
                const item = group.links[0];
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`top-nav-item ${isActive ? "active" : ""}`}
                  >
                    <item.icon size={16} strokeWidth={1.9} />
                    <span>{item.label}</span>
                    {item.href === "/assistant" && <span className="nav-new">AI</span>}
                  </Link>
                );
              }

              const isGroupActive = group.links.some((l) => pathname === l.href);
              const isOpen = activeDropdown === group.title;

              return (
                <div
                  key={group.title}
                  className="top-nav-dropdown-wrap"
                  onMouseEnter={() => setActiveDropdown(group.title)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    type="button"
                    className={`top-nav-item dropdown-toggle ${isGroupActive ? "active" : ""}`}
                    onClick={() => setActiveDropdown(isOpen ? null : group.title)}
                  >
                    <span>{group.title}</span>
                    <ChevronDown size={14} className={`dropdown-chevron ${isOpen ? "open" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="top-nav-dropdown-menu">
                      {group.links.map((item) => (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          className={`dropdown-item ${pathname === item.href ? "active" : ""}`}
                          onClick={() => setActiveDropdown(null)}
                        >
                          <item.icon size={16} strokeWidth={1.8} />
                          <span>{item.label}</span>
                          {item.href === "/assistant" && <span className="nav-new">AI</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="topbar-actions">
            <form className="global-search" onSubmit={search}>
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm nhanh ngành, hồ sơ…"
                aria-label="Tìm kiếm"
              />
              <kbd>⌘ K</kbd>
            </form>

            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                title="Thông báo"
                onClick={() => {
                  setNotificationOpen(!notificationOpen);
                  setAccountOpen(false);
                }}
              >
                <Bell size={18} />
                {unreadCount > 0 && <i />}
              </button>
              {notificationOpen && (
                <div className="notification-menu">
                  <div className="notification-heading">
                    <strong>Thông báo</strong>
                    <span>{unreadCount ? `${unreadCount} chưa đọc` : "Đã cập nhật"}</span>
                  </div>
                  {notifications.length ? (
                    notifications.slice(0, 8).map((notification) => (
                      <button
                        className={`notification-item ${notification.read_at ? "" : "unread"}`}
                        key={notification.id}
                        onClick={async () => {
                          if (!notification.read_at) {
                            await api(`/notifications/${notification.id}/read`, { method: "PATCH" }).catch(() => {});
                            setNotifications((current) =>
                              current.map((item) =>
                                item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
                              )
                            );
                            setUnreadCount((current) => Math.max(0, current - 1));
                          }
                          setNotificationOpen(false);
                          router.push(notification.href);
                        }}
                      >
                        <span className="notification-item-dot" />
                        <span>
                          <strong>{notification.title}</strong>
                          <small>{notification.message}</small>
                          <time>
                            {new Date(notification.created_at).toLocaleString("vi-VN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </time>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="notification-empty">
                      <CheckCheck size={17} />
                      {user ? "Bạn chưa có thông báo mới." : "Đăng nhập để xem thông báo."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {user ? (
              <div className="account-area">
                <button className="account-button" onClick={() => setAccountOpen(!accountOpen)}>
                  <span className="avatar">{user.full_name.split(" ").slice(-1)[0]?.slice(0, 1)}</span>
                  <span className="account-copy">
                    <strong>{user.full_name}</strong>
                    <small>{roleLabel(user.role)}</small>
                  </span>
                  <ChevronDown size={14} />
                </button>
                {accountOpen && (
                  <div className="account-menu">
                    <div className="account-menu-user">
                      <strong>{user.full_name}</strong>
                      <small>{user.email}</small>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setAccountOpen(false);
                      }}
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="button button-primary sign-in" onClick={() => setLoginOpen(true)}>
                <LogIn size={15} /> Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation (khi màn hình nhỏ) */}
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Đóng menu" />}
      <aside className={`mobile-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand-row">
          <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
            <div className="brand-mark">
              <GraduationCap size={20} strokeWidth={2.3} />
            </div>
            <div className="brand-name">
              <strong>
                NEU Study<span>.</span>
              </strong>
              <small>UNIVERSITY PLATFORM</small>
            </div>
          </Link>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <nav className="side-nav">
          {visibleNavigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.links.map((item) => (
                <Link
                  href={item.href}
                  key={item.href + item.label}
                  onClick={() => setMobileOpen(false)}
                  className={`nav-link ${pathname === item.href ? "active" : ""}`}
                >
                  <item.icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.href === "/assistant" && <span className="nav-new">AI</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-orb">
              <Bot size={17} />
            </div>
            <strong>NEU Study AI sẵn sàng</strong>
            <p>Hỏi đáp từ kho tri thức của trường.</p>
            <Link href="/assistant" onClick={() => setMobileOpen(false)}>
              Bắt đầu trò chuyện <ChevronRight size={14} />
            </Link>
          </div>
          <div className="sidebar-foot">
            <span className="online-dot" />Hệ thống hoạt động <span className="version">v1.0.0</span>
          </div>
        </div>
      </aside>

      <main className="main-column">
        <div className="page-content">{children}</div>
        {pathname !== "/assistant" && (
          <Link href="/assistant" className="floating-assistant" aria-label="Mở NEU Study AI Assistant">
            <span className="floating-glow" />
            <Bot size={20} />
            <span>Hỏi NEU Study AI</span>
          </Link>
        )}
      </main>

      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

function roleLabel(role: string) {
  const r = role.toUpperCase();
  if (["ADMIN", "SUPER_ADMIN", "ADMISSION_STAFF", "SUPPORT_STAFF"].includes(r)) return "Quản trị viên";
  if (["GIANG_VIEN", "LECTURER"].includes(r)) return "Giảng viên";
  if (["SINH_VIEN", "STUDENT"].includes(r)) return "Sinh viên";
  return "Thành viên";
}

function LoginDialog({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@study.edu.vn");
  const [password, setPassword] = useState("StudyDemo2026!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const demoPresets = [
    { label: "Quản trị viên", email: "admin@study.edu.vn", role: "ADMIN" },
    { label: "Giảng viên", email: "giangvien@study.edu.vn", role: "GIANG_VIEN" },
    { label: "Sinh viên", email: "sinhvien@study.edu.vn", role: "SINH_VIEN" },
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập chưa thành công.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <div className="login-brand">
          <div className="brand-mark">
            <GraduationCap size={20} />
          </div>
          <span>
            NEU Study<span>.</span>
          </span>
        </div>
        <div className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</div>
        <h2 id="login-title">Đăng nhập Study</h2>
        <p className="muted-text">Đăng nhập theo đúng 3 vai trò: Quản trị viên, Giảng viên hoặc Sinh viên.</p>

        {/* Quick Demo Role Picker */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
          {demoPresets.map((preset) => (
            <button
              key={preset.role}
              type="button"
              onClick={() => {
                setEmail(preset.email);
                setPassword("StudyDemo2026!");
              }}
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                border: email === preset.email ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                background: email === preset.email ? "#e0f2fe" : "#f8fafc",
                color: email === preset.email ? "#0369a1" : "#475569",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="inline-error">{error}</div>}
          <button className="button button-primary full-width" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </section>
    </div>
  );
}
