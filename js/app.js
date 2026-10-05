(() => {
  "use strict";

  const C = window.VPLUS_CONFIG || {};
  const state = {
    products: [],
    cart: loadJSON("vplus_cart", []),
    user: loadJSON("vplus_user", null)
  };

  const $ = s => document.querySelector(s);
  const money = n => Number(n || 0).toLocaleString("fa-IR");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));

  function loadJSON(k, f) {
    try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; }
  }

  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function toast(t) {
    const e = $("#toast");
    if (!e) return;
    e.textContent = t;
    e.classList.add("show");
    setTimeout(() => e.classList.remove("show"), 2500);
  }

  function api(action, data = {}) {
    if (!C.API_URL || C.API_URL.includes("YOUR_")) {
      return Promise.reject(new Error("API_URL تنظیم نشده است"));
    }
    const q = new URLSearchParams({ action, ...data });
    return fetch(C.API_URL + "?" + q.toString(), { method: "GET" })
      .then(r => r.json())
      .then(x => {
        if (!x.ok) throw new Error(x.message || "خطای API");
        return x.data;
      });
  }

  async function sha256(s) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function imageFor(p) {
    const name = p.image || p.imageFile || "";
    return name ? C.IMAGE_DIR + name : "";
  }

  async function loadProducts() {
    const status = $("#productStatus");
    if (status) status.textContent = "در حال دریافت...";

    try {
      state.products = await api("products");
      populateFilters();
      renderProducts();
      if (status) status.textContent = `${money(state.products.length)} محصول`;
      renderCart();
    } catch (e) {
      if (status) status.textContent = "اتصال به فروشگاه برقرار نشد";
      const grid = $("#productGrid");
      if (grid) {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1">برای نمایش محصولات، URL مربوط به Google Apps Script را در <b>config/config.js</b> وارد کنید.</div>`;
      }
      renderCart();
    }
  }

  function populateFilters() {
    const cat = $("#categoryFilter");
    const brand = $("#brandFilter");
    if (!cat || !brand) return;

    const cats = [...new Set(state.products.map(p => p.category).filter(Boolean))].sort();
    const brands = [...new Set(state.products.map(p => p.brand).filter(Boolean))].sort();
    cat.innerHTML = '<option value="">همه دسته‌ها</option>' + cats.map(x => `<option>${esc(x)}</option>`).join("");
    brand.innerHTML = '<option value="">همه برندها</option>' + brands.map(x => `<option>${esc(x)}</option>`).join("");
  }

  function filtered() {
    const search = $("#searchInput");
    const cat = $("#categoryFilter");
    const brand = $("#brandFilter");
    const q = search ? search.value.trim().toLowerCase() : "";
    const c = cat ? cat.value : "";
    const b = brand ? brand.value : "";

    return state.products.filter(p =>
      (!q || [p.name, p.code, p.brand, p.category].join(" ").toLowerCase().includes(q)) &&
      (!c || p.category === c) &&
      (!b || p.brand === b)
    );
  }

  function renderProducts() {
    const grid = $("#productGrid");
    if (!grid) return;

    const arr = filtered();
    const empty = $("#emptyProducts");
    if (empty) empty.classList.toggle("hidden", arr.length !== 0);

    grid.innerHTML = arr.map(p => {
      const src = imageFor(p);
      return `<article class="product-card">
        <div class="product-image">${src ? `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=no-image>◉</span>'>` : '<span class="no-image">◉</span>'}</div>
        <div class="product-info">
          <h3>${esc(p.name)}</h3>
          <div class="product-meta">${esc([p.brand, p.code].filter(Boolean).join(" • "))}</div>
          <div class="price">${money(p.price)} <small>${esc(C.CURRENCY || "تومان")}</small></div>
          <div class="product-actions">
            <button class="add-btn" onclick="VPlus.add('${esc(String(p.id))}')">افزودن</button>
            <button class="detail-btn" onclick="VPlus.detail('${esc(String(p.id))}')">جزئیات</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function find(id) { return state.products.find(p => String(p.id) === String(id)); }

  function add(id) {
    const p = find(id);
    if (!p) return;
    const old = state.cart.find(x => String(x.id) === String(id));
    old ? old.qty++ : state.cart.push({ id: p.id, qty: 1 });
    save("vplus_cart", state.cart);
    renderCart();
    updateCount();
    toast("محصول به سبد خرید اضافه شد");
  }

  function change(id, d) {
    const x = state.cart.find(a => String(a.id) === String(id));
    if (!x) return;
    x.qty += d;
    if (x.qty < 1) state.cart = state.cart.filter(a => String(a.id) !== String(id));
    save("vplus_cart", state.cart);
    renderCart();
    updateCount();
  }

  function remove(id) {
    state.cart = state.cart.filter(a => String(a.id) !== String(id));
    save("vplus_cart", state.cart);
    renderCart();
    updateCount();
  }

  function updateCount() {
    const count = $("#cartCount");
    if (count) count.textContent = state.cart.reduce((s, x) => s + x.qty, 0);
  }

  function renderCart() {
    const box = $("#cartBox");
    if (!box) return;

    if (!state.cart.length) {
      box.innerHTML = '<div class="empty">سبد خرید شما خالی است.</div>';
      return;
    }

    let total = 0;
    const rows = state.cart.map(x => {
      const p = find(x.id);
      if (!p) return "";
      total += Number(p.price || 0) * x.qty;
      return `<div class="cart-row">
        <div><strong>${esc(p.name)}</strong><div class="product-meta">${money(p.price)} تومان</div></div>
        <div class="qty"><button onclick="VPlus.change('${esc(x.id)}',-1)">−</button><b>${x.qty}</b><button onclick="VPlus.change('${esc(x.id)}',1)">+</button></div>
        <strong>${money(Number(p.price) * x.qty)} تومان</strong>
        <button class="remove" onclick="VPlus.remove('${esc(x.id)}')">حذف</button>
      </div>`;
    }).join("");

    if (!rows) {
      box.innerHTML = '<div class="empty">سبد خرید شما خالی است.</div>';
      return;
    }

    box.innerHTML = `<div class="cart-list">${rows}</div>
      <div class="cart-total"><div>جمع سبد</div><strong>${money(total)} تومان</strong><button class="primary-btn" onclick="VPlus.checkout()">ثبت سفارش</button></div>`;
  }

  function detail(id) {
    const p = find(id);
    const content = $("#modalContent");
    const modal = $("#modal");
    if (!p || !content || !modal) return;

    content.innerHTML = `<span class="eyebrow">${esc(p.category || "قطعه خودرو")}</span><h2>${esc(p.name)}</h2><p class="muted">برند: ${esc(p.brand || "—")}<br>کد کالا: ${esc(p.code || "—")}</p><div class="price">${money(p.price)} تومان</div><button class="primary-btn" onclick="VPlus.add('${esc(p.id)}');VPlus.closeModal()">افزودن به سبد</button>`;
    modal.classList.remove("hidden");
  }

  function closeModal() {
    $("#modal")?.classList.add("hidden");
  }

  function account() {
    const b = $("#accountBox");
    if (!b) return;

    if (state.user) {
      b.innerHTML = `<div class="account-info"><span class="eyebrow">حساب فعال</span><h3>${esc(state.user.name)}</h3><p>${esc(state.user.phone)}</p><button class="nav-btn" onclick="VPlus.logout()">خروج از حساب</button></div>`;
    } else {
      b.innerHTML = `<div class="account-grid"><div class="auth-card"><h3>ورود</h3><form id="loginForm"><input name="phone" placeholder="شماره موبایل" required><input name="password" type="password" placeholder="رمز عبور" required><button class="primary-btn">ورود به حساب</button></form></div><div class="auth-card"><h3>ثبت‌نام</h3><form id="registerForm"><input name="name" placeholder="نام و نام خانوادگی" required><input name="phone" placeholder="شماره موبایل" required><input name="password" type="password" minlength="4" placeholder="رمز عبور" required><button class="primary-btn">ساخت حساب</button></form></div></div>`;
    }

    $("#loginForm")?.addEventListener("submit", login);
    $("#registerForm")?.addEventListener("submit", register);
  }

  async function login(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const d = await api("login", { phone: f.get("phone"), password: await sha256(f.get("password")) });
      state.user = d;
      save("vplus_user", d);
      account();
      toast("ورود با موفقیت انجام شد");
    } catch (x) { toast(x.message); }
  }

  async function register(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const d = await api("register", { name: f.get("name"), phone: f.get("phone"), password: await sha256(f.get("password")) });
      state.user = d;
      save("vplus_user", d);
      account();
      toast("حساب شما ساخته شد");
    } catch (x) { toast(x.message); }
  }

  function logout() {
    state.user = null;
    localStorage.removeItem("vplus_user");
    account();
    toast("از حساب خارج شدید");
  }

  function checkout() {
    if (!state.user) {
      location.href = "account.html";
      return;
    }
    if (!state.cart.length) return;

    const items = state.cart.map(x => {
      const p = find(x.id);
      return p ? { id: p.id, name: p.name, qty: x.qty, price: p.price } : null;
    }).filter(Boolean);

    const content = $("#modalContent");
    const modal = $("#modal");
    if (!content || !modal) {
      location.href = "cart.html";
      return;
    }

    content.innerHTML = `<h2>ثبت سفارش</h2><p class="info-box">سفارش شما ثبت می‌شود و پس از بررسی با شما تماس می‌گیریم.</p><form id="orderForm" class="order-form"><input name="address" placeholder="آدرس تحویل" required><input name="postal" placeholder="کد پستی (اختیاری)"><textarea name="note" placeholder="توضیحات سفارش"></textarea><button class="primary-btn">ثبت نهایی سفارش</button></form>`;
    modal.classList.remove("hidden");

    $("#orderForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api("order", { userId: state.user.id, items: JSON.stringify(items), address: f.get("address"), postal: f.get("postal"), note: f.get("note") });
        state.cart = [];
        save("vplus_cart", state.cart);
        renderCart();
        updateCount();
        closeModal();
        toast("سفارش با موفقیت ثبت شد");
      } catch (x) { toast(x.message); }
    });
  }

  function setupCommon() {
    const menu = $(".main-nav");
    $("#menuBtn")?.addEventListener("click", () => menu?.classList.toggle("open"));
    $("#logoutBtn")?.addEventListener("click", logout);
    $("#modalClose")?.addEventListener("click", closeModal);
    $("#modal")?.addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
    $("#year") && ($("#year").textContent = new Date().getFullYear());
    updateCount();
  }

  function setupProductsPage() {
    if (!$("#productGrid")) return;
    $("#searchInput")?.addEventListener("input", renderProducts);
    $("#categoryFilter")?.addEventListener("change", renderProducts);
    $("#brandFilter")?.addEventListener("change", renderProducts);
    loadProducts();
  }

  function setupCartPage() {
    if (!$("#cartBox")) return;
    loadProducts();
  }

  function setupSupportPage() {
    const phone = $("#phoneLink");
    const whatsapp = $("#whatsappLink");
    const form = $("#supportForm");

    if (phone) {
      phone.href = "tel:" + (C.PHONE || "");
      phone.textContent = C.PHONE || "تماس تلفنی";
    }
    if (whatsapp) whatsapp.href = "https://wa.me/" + (C.WHATSAPP || "");
    if (!form) return;

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!state.user) {
        location.href = "account.html";
        return;
      }
      const f = new FormData(e.target);
      try {
        await api("support", { userId: state.user.id, subject: f.get("subject"), message: f.get("message") });
        e.target.reset();
        toast("پیام شما ارسال شد");
      } catch (x) { toast(x.message); }
    });
  }

  window.VPlus = { add, change, remove, detail, closeModal, checkout, logout };
  setupCommon();
  account();
  setupProductsPage();
  setupCartPage();
  setupSupportPage();
})();
