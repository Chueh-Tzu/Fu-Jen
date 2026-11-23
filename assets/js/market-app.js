(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var CART_KEY = "immba-market-cart";
  var MODE_KEY = "immba-market-mode";
  var SAMPLES = [
    { name_zh: "校友藍牙耳機", name_en: "Alumni Bluetooth Earbuds", category: "Electronics", description_zh: "海軍藍配金色飾邊的真無線耳機，附充電盒與充電線。適合通勤和上課，觸控即可操作，外觀與功能均正常。", description_en: "Navy true-wireless earbuds with gold trim, a charging case, and a cable. Comfortable for commuting and class, with touch controls. Appearance and functions have been checked.", price: 3500, quantity: 1, image_url: "assets/img/market-earbuds.jpg" },
    { name_zh: "筆電", name_en: "Laptop", category: "Electronics", description_zh: "銀色輕薄筆電，適合寫報告、視訊上課與文書作業。螢幕、鍵盤與觸控板正常，附充電線，已恢復原廠設定，開機即可使用。", description_en: "A slim silver laptop for reports, online classes, and everyday writing. The display, keyboard, and trackpad work normally, a charger is included, and it has been reset so it is ready to use.", price: 25000, quantity: 1, image_url: "assets/img/market-laptop.jpg", video_url: "assets/img/market-laptop.mp4" },
    { name_zh: "imMBA 手持風扇", name_en: "imMBA Handheld Fan", category: "Daily", description_zh: "適合校園使用的手持風扇", description_en: "Handheld fan for campus use", price: 680, quantity: 1, image_url: "assets/img/market-fan.jpg" },
    { name_zh: "imMBA 二手平板", name_en: "imMBA Second-Hand Tablet", category: "Daily", description_zh: "二手平板", description_en: "Second-hand tablet", price: 4500, quantity: 1, image_url: "assets/img/market-tablet.jpg" }
  ];

  var me = null;
  var products = [];
  var orders = [];
  var changeLogs = [];
  var fee = 4;
  var view = "listings";
  var mode = "buyer";
  var cartEditId = "";
  var cartPicked = {};
  var overviewOrderId = "";
  var adminDetailId = "";
  var memberDetailId = "";
  var ready = false;
  var statusNote = null;
  var statusTimer = null;

  var statusEl = document.getElementById("market-status");

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }
  function t(zh, en) {
    return isEn() ? en : zh;
  }
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function money(value) {
    var amount = Number(value || 0).toLocaleString("en-US");
    return t(amount + " 元", "NT$ " + amount);
  }
  function showStatus(zh, en, kind, stayMs) {
    statusNote = { zh: zh, en: en || zh, kind: kind || "ok" };
    paintStatus();
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    statusTimer = setTimeout(function () {
      statusTimer = null;
      statusNote = null;
      paintStatus();
    }, stayMs == null ? 8000 : stayMs);
  }
  function paintStatus() {
    if (!statusNote || !statusNote.zh) {
      statusEl.hidden = true;
      return;
    }
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + statusNote.kind;
    statusEl.textContent = t(statusNote.zh, statusNote.en);
  }
  function productTitle(item) {
    var zh = item.name_zh || "";
    var en = item.name_en || item.name || "";
    return isEn() ? (en || zh) : (zh || en);
  }
  function productBlurb(item) {
    var zh = item.description_zh || "";
    var en = item.description_en || item.description || "";
    return (isEn() ? (en || zh) : (zh || en)) || t("未提供說明", "No description provided");
  }
  function lineTitle(item) {
    var product = item.product_id ? productById(item.product_id) : null;
    var zh = item.product_name_zh || (product && product.name_zh) || "";
    var en = item.product_name_en || item.product_name || (product && (product.name_en || product.name)) || "";
    return (isEn() ? (en || zh) : (zh || en)) + " x" + item.quantity;
  }
  function formatTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    return parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute;
  }
  function statusLabel(status) {
    if (status === "awaiting_payment") return t("待確認付款", "Waiting for payment confirmation");
    if (status === "payment_confirmed") return t("已確認付款", "Payment confirmed");
    if (status === "ready_to_ship") return t("待出貨", "Ready to ship");
    if (status === "shipped") return t("已出貨", "Shipped");
    if (status === "arrived") return t("已到貨", "Arrived");
    if (status === "completed") return t("已完成", "Completed");
    if (status === "cancelled") return t("已取消", "Cancelled");
    if (status === "listed") return t("上架中", "Listed");
    if (status === "hidden") return t("已隱藏", "Hidden");
    if (status === "sold") return t("已售出", "Sold");
    return status || "";
  }
  function categoryLabel(category) {
    if (category === "Electronics") return t("3C", "Electronics");
    if (category === "Books") return t("書籍", "Books");
    if (category === "Daily") return t("生活用品", "Daily");
    return t("其他", "Other");
  }
  function shippingLabel(method) {
    return method === "delivery"
      ? t("宅配（運費 80 元）", "Home delivery (shipping fee NT$ 80)")
      : t("面交（免運）", "In-person pickup (free)");
  }

  function pickupMeetText() {
    return t("於 LM208 中午 12:00 面交", "In-person pickup at LM208, 12:00 noon");
  }

  function fulfillmentText(order) {
    if (!order) return "";
    var parts = [];
    if (order.shipping_method === "pickup") parts.push(pickupMeetText());
    if (order.ship_date) parts.push(t("出貨日期 ", "Ship date ") + order.ship_date);
    if (order.arrival_date) parts.push(t("抵達日期 ", "Arrival date ") + order.arrival_date);
    return parts.join(" · ");
  }

  function fulfillmentNote(order) {
    var text = fulfillmentText(order);
    return text ? '<p class="swap-note">' + escapeHtml(text) + "</p>" : "";
  }
  async function logMarket(entry) {
    if (!auth.writeActivity) return;
    try {
      await auth.writeActivity(entry);
    } catch (err) {
      return;
    }
  }

  function uid() {
    return me && me.session && me.session.user ? me.session.user.id : "";
  }
  function isAdmin() {
    return !!(me && me.profile && auth.isAdminRole(me.profile.role));
  }
  function isSuper() {
    return !!(me && me.profile && me.profile.role === "super_admin");
  }
  function canSell() {
    return !!(me && me.profile && auth.isMarketMember && auth.isMarketMember(me.profile.role));
  }
  function canBuy() {
    return !!(me && me.profile && auth.isMarketBuyer && auth.isMarketBuyer(me.profile.role));
  }
  function registeredSide() {
    var apply = me && me.profile && me.profile.apply_as;
    return apply === "seller" || apply === "buyer" ? apply : "";
  }
  function applySideMode() {
    var side = registeredSide();
    if (side === "seller") mode = "seller";
    else if (side === "buyer") mode = "buyer";
    else if (entryChoice === "seller" && canSell()) mode = "seller";
    else if (entryChoice !== "seller" && canBuy()) mode = "buyer";
    else if (canSell() && !canBuy()) mode = "seller";
    else mode = "buyer";
    localStorage.setItem(MODE_KEY, mode);
  }
  function cartKey() {
    return CART_KEY + ":" + (uid() || "guest");
  }
  function readCart() {
    try {
      var parsed = JSON.parse(localStorage.getItem(cartKey()) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  function writeCart(cart) {
    localStorage.setItem(cartKey(), JSON.stringify(cart));
  }
  function readMode() {
    var saved = localStorage.getItem(MODE_KEY);
    return saved === "seller" ? "seller" : "buyer";
  }

  function productById(id) {
    return products.filter(function (item) { return item.id === id; })[0] || null;
  }
  function itemNames(order) {
    return (order.market_order_items || []).map(function (item) {
      return lineTitle(item);
    }).join(t("、", ", "));
  }
  function visibleProducts() {
    return products.filter(function (item) {
      return item.status === "listed";
    });
  }

  function shortCode(id) {
    return String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase();
  }

  function orderCode(order) {
    var date = new Date(order.created_at || order.updated_at);
    if (isNaN(date.getTime())) return shortCode(order.id);
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    return "MK " + parts.year + "-" + parts.month + parts.day + "." + shortCode(order.id).slice(0, 4);
  }

  function purchasedCount(productId) {
    var count = 0;
    orders.forEach(function (order) {
      (order.market_order_items || []).forEach(function (item) {
        if (item.product_id === productId) count += Number(item.quantity) || 0;
      });
    });
    return count;
  }

  function setView(next) {
    var side = registeredSide();
    if ((next === "seller" || next === "inventory" || next === "compose" || next === "changes") && (side === "buyer" || !canSell())) next = "listings";
    if (next === "admin" && !isAdmin()) next = "listings";
    if ((next === "cart" || next === "pay" || next === "member" || next === "account") && (side === "seller" || !canBuy())) {
      next = side === "seller" && canSell() ? "inventory" : "listings";
    }
    view = next;
    ["listings", "inventory", "compose", "changes", "cart", "pay", "member", "seller", "admin", "account"].forEach(function (name) {
      var panel = document.getElementById("market-view-" + name);
      if (panel) panel.hidden = name !== next;
    });
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.classList.toggle("is-current", button.getAttribute("data-view") === next);
    });
    document.getElementById("market-form").hidden = next !== "compose";
    if (next === "listings") renderListings();
    if (next === "inventory") renderInventory();
    if (next === "changes") renderChanges();
    if (next === "cart") renderCart();
    if (next === "pay") renderPay();
    if (next === "member") renderMember();
    if (next === "seller") renderSeller();
    if (next === "admin") renderAdmin();
    if (next === "account") renderAccount();
  }

  function selling() {
    if (registeredSide() === "buyer") return false;
    if (registeredSide() === "seller") return canSell();
    return canSell() && mode === "seller";
  }

  function pendingSellerOrders() {
    return orders.filter(function (order) {
      return order.seller_id === uid() && order.status !== "completed" && order.status !== "cancelled";
    }).length;
  }

  function cancelRequested(order) {
    return !!(order && order.cancel_reason && order.status !== "cancelled");
  }

  function orderBadge(order) {
    if (cancelRequested(order)) return t("待確認取消", "Cancellation requested");
    return statusLabel(order.status);
  }

  function renderChrome() {
    var signedIn = !!(me && me.profile);
    var approved = canBuy();
    var sellerView = selling();
    document.getElementById("market-role").hidden = !!registeredSide() || !(canSell() && canBuy());
    document.getElementById("market-listings-btn").hidden = false;
    document.getElementById("market-cart-btn").hidden = !approved || sellerView;
    document.getElementById("market-member-btn").hidden = !approved || sellerView;
    document.getElementById("market-add-btn").hidden = !sellerView;
    document.getElementById("market-changes-btn").hidden = !sellerView;
    document.getElementById("market-inventory-btn").hidden = !sellerView;
    document.getElementById("market-seller-btn").hidden = !sellerView;
    document.getElementById("market-admin-btn").hidden = !isAdmin();
    document.getElementById("market-users-link").hidden = !(canBuy() || canSell());
    document.getElementById("market-login").hidden = signedIn;
    document.getElementById("market-signout").hidden = !signedIn;
    document.getElementById("market-become-seller").hidden = registeredSide() === "buyer" || !canSell() || sellerView;
    document.getElementById("market-buyer-mode").hidden = !sellerView;
    document.getElementById("market-buyer-label").hidden = sellerView;
    document.getElementById("market-seller-label").hidden = !sellerView;
    document.getElementById("market-seller-divider").hidden = !sellerView;
    document.getElementById("market-admin-label").hidden = !isAdmin();
    document.getElementById("market-who").textContent = signedIn
      ? (me.profile.display_name || me.profile.email || "")
      : "";
    document.getElementById("market-fee-note").hidden = sellerView;
    document.getElementById("market-fee-amount").textContent = String(fee);
    document.getElementById("market-fee-amount-en").textContent = String(fee);
    document.getElementById("market-locale").textContent = isEn() ? "中文" : "EN";
    document.getElementById("market-listings-btn").innerHTML =
      '<span class="zh">瀏覽商品</span><span class="en">Browse</span>';
    var pending = canSell() ? pendingSellerOrders() : 0;
    document.getElementById("market-seller-count").textContent = pending
      ? t("（" + pending + "）", "(" + pending + ")")
      : "";
    document.querySelectorAll("[data-mode]").forEach(function (button) {
      button.classList.toggle("is-current", button.getAttribute("data-mode") === mode);
    });
    var copy = document.getElementById("market-role-copy");
    copy.classList.toggle("is-seller", sellerView);
    if (!signedIn) {
      copy.textContent = t(
        "訪客可以瀏覽市集中所有已上架商品。登入後才能加入購物車。",
        "Visitors can browse every listed product. Sign in to add items to the cart."
      );
    } else if (registeredSide() === "seller" || (canSell() && !canBuy())) {
      copy.textContent = t(
        "賣家：可以管理自己的商品，以及處理自己的訂單。不能下單。",
        "Seller: you can manage your own products and process your own orders. You cannot place orders."
      );
    } else if (registeredSide() === "buyer" || !canSell()) {
      copy.textContent = t(
        "買家：可以瀏覽商品、下單，以及查看自己的訂單。不能修改庫存、管理商品，也不能進入管理頁。",
        "Buyer: you can browse, buy, and view your own orders. You cannot edit inventory, manage products, or open admin pages."
      );
    } else if (sellerView) {
      copy.textContent = t(
        "賣家頁面：新增商品、編輯商品、管理庫存、確認付款與出貨。要購買時，請切換到買家模式。",
        "Seller view: add products, edit listings, manage inventory, and confirm payment or shipment. Switch to Buyer mode when you want to buy."
      );
    } else {
      copy.textContent = t(
        "買家模式：這裡會列出市集中所有已上架商品。選好數量後可以加入購物車。",
        "Buyer mode: every listed item in the marketplace is shown here. Choose a quantity, then add it to the cart."
      );
    }
    var stats = document.getElementById("market-stats");
    if (!approved) {
      stats.hidden = true;
      document.getElementById("market-seller-notice").hidden = true;
      return;
    }
    var listed = products.filter(function (item) {
      return item.seller_id === uid() && item.status === "listed";
    }).length;
    var bought = 0;
    orders.forEach(function (order) {
      if (order.buyer_id !== uid()) return;
      (order.market_order_items || []).forEach(function (item) {
        bought += Number(item.quantity) || 0;
      });
    });
    var notice = document.getElementById("market-seller-notice");
    var cancelAsks = signedIn ? orders.filter(function (order) {
      return order.seller_id === uid() && cancelRequested(order);
    }).length : 0;
    var openOrders = signedIn ? orders.filter(function (order) {
      return order.seller_id === uid() && order.status !== "completed" && order.status !== "cancelled" && !cancelRequested(order);
    }).length : 0;
    if (!signedIn || (!cancelAsks && (sellerView || !openOrders))) {
      notice.hidden = true;
      notice.innerHTML = "";
    } else if (cancelAsks) {
      notice.hidden = false;
      notice.innerHTML =
        escapeHtml(t(
          "賣家通知：買家申請取消 " + cancelAsks + " 筆訂單，請按「確認取消」。",
          "Seller notice: a buyer asked to cancel " + cancelAsks + " order(s). Press Confirm cancellation."
        )) +
        (sellerView
          ? ""
          : ' <button type="button" class="btn btn-gold" id="market-open-seller">' +
            t("前往賣家訂單", "Open seller orders") + "</button>");
    } else {
      notice.hidden = false;
      notice.innerHTML =
        escapeHtml(t(
          "賣家通知：你有 " + openOrders + " 筆訂單需要處理。",
          "Seller notice: you have " + openOrders + " orders to handle."
        )) +
        ' <button type="button" class="btn btn-gold" id="market-open-seller">' +
        t("前往賣家訂單", "Open seller orders") + "</button>";
    }
    stats.hidden = false;
    stats.textContent = sellerView
      ? t(
        "上架商品 " + listed + " 件 / 待確認付款 " + pending + " 筆 / 目前模式：賣家模式",
        "Listed products: " + listed + " / Pending payments: " + pending + " / Current mode: Seller mode"
      )
      : t(
        "已購買 " + bought + " 件 / 目前模式：買家模式",
        "Purchased items: " + bought + " / Current mode: Buyer mode"
      );
  }

  function productPhotos(item) {
    var raw = item && item.image_urls;
    var list = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw && typeof raw === "object") list = [];
    else if (typeof raw === "string" && raw) {
      try { list = JSON.parse(raw); } catch (err) { list = []; }
    }
    list = (Array.isArray(list) ? list : []).map(function (url) {
      return String(url || "").trim();
    }).filter(Boolean).slice(0, 10);
    if (!list.length && item && item.image_url) list = [String(item.image_url)];
    return list;
  }

  function photoThumbs(photos) {
    if (photos.length < 2) return "";
    return '<div class="market-photo-thumbs">' + photos.map(function (url, index) {
      return '<button type="button" class="market-photo-thumb' + (index === 0 ? " is-current" : "") + '" data-photo="' + escapeHtml(url) + '">' +
        '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(t("第 " + (index + 1) + " 張", "Photo " + (index + 1))) + '"></button>';
    }).join("") + "</div>";
  }

  function cardMedia(item) {
    var title = escapeHtml(productTitle(item));
    var photos = productPhotos(item);
    var cover = photos[0] || "";
    if (item.video_url) {
      return '<div class="market-media-wrap">' +
        '<video class="market-media" controls muted playsinline preload="none"' +
        (cover ? ' poster="' + escapeHtml(cover) + '"' : "") +
        ' aria-label="' + escapeHtml(t("產品影片：", "Product video: ")) + title + '">' +
        '<source src="' + escapeHtml(item.video_url) + '" type="video/mp4"></video>' +
        '<span class="market-video-tag">' + escapeHtml(t("產品影片", "Product video")) + "</span>" +
        photoThumbs(photos) + "</div>";
    }
    if (cover) {
      return '<div class="market-media-wrap">' +
        '<img class="market-media" src="' + escapeHtml(cover) + '" alt="' + title + '" loading="lazy">' +
        photoThumbs(photos) + "</div>";
    }
    return '<div class="market-media market-media-empty">' + escapeHtml(t("無圖片", "No image")) + "</div>";
  }

  function renderListings() {
    var grid = document.getElementById("market-grid");
    var title = document.getElementById("market-list-title");
    var filter = document.getElementById("market-category-filter");
    var search = (document.getElementById("market-search").value || "").trim().toLowerCase();
    var min = Number(document.getElementById("market-min").value);
    var max = Number(document.getElementById("market-max").value);
    var inStock = document.getElementById("market-instock").checked;
    title.innerHTML = '<span class="zh">瀏覽商品</span><span class="en">Browse items</span>';
    var rows = visibleProducts().filter(function (item) {
      var name = (productTitle(item) + " " + (item.name_zh || "") + " " + (item.name_en || "")).toLowerCase();
      var price = Number(item.price) || 0;
      var stock = Number(item.quantity) || 0;
      if (filter.value && filter.value !== "all" && item.category !== filter.value) return false;
      if (search && name.indexOf(search) === -1 && shortCode(item.id).toLowerCase().indexOf(search) === -1) return false;
      if (document.getElementById("market-min").value !== "" && price < min) return false;
      if (document.getElementById("market-max").value !== "" && price > max) return false;
      if (inStock && stock <= 0) return false;
      return true;
    });
    document.getElementById("market-list-count").textContent = t(rows.length + " 件商品", rows.length + " items");
    if (!rows.length) {
      grid.innerHTML = '<p class="market-empty">' + escapeHtml(t("目前沒有符合的商品。", "No items match these filters.")) + "</p>";
      return;
    }
    var cart = readCart();
    grid.innerHTML = rows.map(function (item) {
      var stock = Number(item.quantity) || 0;
      var qty = Math.max(1, Math.min(Number(cart[item.id] || 1), Math.max(stock, 1)));
      var actions = "";
      if (stock <= 0) {
        actions = '<p class="market-note">' + escapeHtml(t("已售完", "Sold out")) + "</p>";
      } else if (canBuy()) {
        actions =
          '<label class="market-qty">' + t("數量", "Qty") +
          ' <input data-qty="' + item.id + '" type="number" min="1" max="' + stock + '" value="' + qty + '"></label>' +
          '<button type="button" class="btn btn-gold" data-cart="' + item.id + '">' + t("加入購物車", "Add to cart") + "</button>";
      } else {
        actions = '<button type="button" class="btn btn-gold" data-open-auth>' + t("登入後下單", "Sign in to order") + "</button>";
      }
      return (
        '<article class="swap-card" data-product="' + item.id + '">' +
        cardMedia(item) +
        '<div class="swap-card-body">' +
        '<p class="swap-code"><span>' + escapeHtml(shortCode(item.id)) + "</span> " + escapeHtml(categoryLabel(item.category)) + "</p>" +
        "<h3>" + escapeHtml(productTitle(item)) + "</h3>" +
        '<p class="market-price">' + escapeHtml(money(item.price)) + "</p>" +
        "<p>" + escapeHtml(t("剩下 " + stock + " 件", stock + " left")) + " · " +
        escapeHtml(t("賣家：", "Seller: ") + (item.seller_name || t("已註冊會員", "Registered member"))) + "</p>" +
        '<div class="market-card-actions">' + actions + "</div></div></article>"
      );
    }).join("");
  }

  function closeProductDetail() {
    var dialog = document.getElementById("market-product-dialog");
    if (!dialog) return;
    dialog.querySelectorAll("video").forEach(function (video) { video.pause(); });
    if (dialog.open) dialog.close();
  }

  function openProductDetail(item) {
    var dialog = document.getElementById("market-product-dialog");
    var body = document.getElementById("market-product-detail");
    if (!dialog || !body || !item) return;
    var nameZh = String(item.name_zh || "").trim();
    var nameEn = String(item.name_en || item.name || "").trim();
    var descZh = String(item.description_zh || "").trim();
    var descEn = String(item.description_en || item.description || "").trim();
    var otherName = isEn() ? nameZh : nameEn;
    var title = productTitle(item);
    if (otherName && otherName === title) otherName = "";
    var stock = Number(item.quantity) || 0;
    var copy = "";
    if (descZh) {
      copy += "<h3>" + escapeHtml(t("介紹說明", "Chinese description")) + "</h3><p class=\"market-product-copy\">" + escapeHtml(descZh) + "</p>";
    }
    if (descEn && descEn !== descZh) {
      copy += "<h3>" + escapeHtml(t("英文說明", "Description")) + "</h3><p class=\"market-product-copy\">" + escapeHtml(descEn) + "</p>";
    }
    if (!copy) {
      copy = "<h3>" + escapeHtml(t("介紹說明", "Description")) + "</h3><p class=\"market-product-copy\">" + escapeHtml(t("未提供說明", "No description provided")) + "</p>";
    }
    body.innerHTML =
      cardMedia(item) +
      '<p class="swap-code"><span>' + escapeHtml(shortCode(item.id)) + "</span> " + escapeHtml(categoryLabel(item.category)) + "</p>" +
      "<h2>" + escapeHtml(title) + "</h2>" +
      (otherName ? '<p class="market-product-alt">' + escapeHtml(otherName) + "</p>" : "") +
      '<p class="market-price">' + escapeHtml(money(item.price)) + "</p>" +
      "<p>" + escapeHtml(t("剩下 " + stock + " 件", stock + " left")) + " · " +
      escapeHtml(t("賣家：", "Seller: ") + (item.seller_name || t("已註冊會員", "Registered member"))) + "</p>" +
      copy;
    var close = document.getElementById("market-product-close");
    if (close) close.setAttribute("aria-label", t("關閉", "Close"));
    if (!dialog.open) dialog.showModal();
  }

  function inventoryActions(item) {
    return '<div class="swap-actions"><button type="button" class="btn btn-outline" data-edit="' + item.id + '">' +
      t("編輯", "Edit") + "</button>" +
      '<button type="button" class="btn btn-outline" data-hide="' + item.id + '">' + t("隱藏", "Hide") + "</button>" +
      '<button type="button" class="btn btn-outline" data-delete-product="' + item.id + '">' +
      t("刪除", "Delete") + "</button></div>";
  }

  function renderInventory() {
    var body = document.getElementById("market-inventory-body");
    var mine = products.filter(function (item) { return item.seller_id === uid(); });
    var total = mine.reduce(function (sum, item) {
      return sum + (item.status === "listed" ? Number(item.quantity) || 0 : 0);
    }, 0);
    document.getElementById("market-stock-total").textContent = t(
      "可售數量 = 目前庫存 − 已購買數量。可售共 " + total + " 件",
      "Available stock = current inventory − purchased quantity. Available: " + total
    );
    if (!mine.length) {
      body.innerHTML = '<tr><td colspan="7">' + escapeHtml(t("尚未上架商品。", "No listings yet.")) + "</td></tr>";
      return;
    }
    body.innerHTML = mine.map(function (item) {
      var available = Number(item.quantity) || 0;
      var purchased = purchasedCount(item.id);
      var inventory = available + purchased;
      var stockNote = item.status === "listed" && available <= 1
        ? '<span class="swap-pill is-low">' + escapeHtml(t("不足", "Low")) + "</span>"
        : '<span class="swap-pill is-ok">' + escapeHtml(t("有庫存", "In stock")) + "</span>";
      return (
        "<tr><td class=\"is-item\"><strong>" + escapeHtml(shortCode(item.id)) + "</strong><br>" + escapeHtml(productTitle(item)) +
        "<br><span class=\"swap-muted\">" + escapeHtml(categoryLabel(item.category)) + "</span></td>" +
        "<td class=\"is-num\">" + escapeHtml(money(item.price)) + "</td>" +
        "<td class=\"is-num\">" + inventory + "</td><td class=\"is-num\">" + purchased + "</td>" +
        "<td class=\"is-num\">" + available + " " + stockNote + "</td>" +
        "<td class=\"is-num\"><span class=\"swap-pill\">" + escapeHtml(statusLabel(item.status)) + "</span></td>" +
        '<td class="is-actions">' + inventoryActions(item) + "</td></tr>"
      );
    }).join("");
  }

  function changeFieldLabel(field) {
    var labels = {
      name: ["名稱", "Name"],
      name_zh: ["中文名稱", "Chinese name"],
      name_en: ["英文名稱", "English name"],
      category: ["分類", "Category"],
      description: ["說明", "Description"],
      description_zh: ["中文說明", "Chinese description"],
      description_en: ["英文說明", "English description"],
      price: ["金額", "Price"],
      quantity: ["數量", "Quantity"],
      image_url: ["照片", "Photo"],
      image_urls: ["照片", "Photos"],
      video_url: ["影片", "Video"],
      status: ["上架狀態", "Listing status"]
    };
    var pair = labels[field] || [field, field];
    return t(pair[0], pair[1]);
  }

  function changeValue(field, value) {
    if (value == null || value === "") return t("（空）", "(empty)");
    if (field === "price") return money(value);
    if (field === "status") return statusLabel(String(value));
    if (field === "category") return categoryLabel(String(value));
    return String(value);
  }

  function changeAction(entry) {
    var name = (entry && (entry.actor_name || entry.seller_name)) || t("會員", "Member");
    var code = entry && (entry.action_code || entry.action);
    if (code === "order") return name + t("下單", " placed an order");
    if (code === "restock") return name + t("取消訂單", " cancelled an order");
    if (code === "create" || code === "INSERT") return name + t("上架新商品", " listed a new item");
    if (code === "delete" || code === "DELETE") return name + t("刪除商品", " deleted an item");
    if (code === "unlist") return name + t("下架商品", " unlisted an item");
    if (code === "relist") return name + t("重新上架", " listed an item again");
    if (code === "quantity") return name + t("調整數量", " changed the quantity");
    if (code === "price") return name + t("修改金額", " changed the price");
    if (code === "edit" || code === "UPDATE") return name + t("修改商品", " edited an item");
    return name + t("變更", " made a change");
  }

  function changeDetail(entry) {
    var rows = (entry.changes || []).filter(function (row) {
      return row.field !== "image_url" || !(entry.changes || []).some(function (other) { return other.field === "image_urls"; });
    });
    if (!rows.length) return escapeHtml(changeAction(entry));
    return rows.map(function (row) {
      var label = escapeHtml(changeFieldLabel(row.field));
      if (row.field === "image_url" || row.field === "image_urls" || row.field === "video_url") return label + t("已更換", " changed");
      var next = escapeHtml(changeValue(row.field, row.to));
      if (row.from == null || row.from === "") return label + "：" + next;
      return label + "：" + escapeHtml(changeValue(row.field, row.from)) + " → " + next;
    }).join("<br>");
  }

  function renderChanges() {
    var body = document.getElementById("market-changes-body");
    var note = document.getElementById("market-changes-note");
    if (!body || !note) return;
    note.textContent = isSuper()
      ? t("超級管理員可查看所有賣家的每一筆變更。共 " + changeLogs.length + " 筆。", "Super admins can see every seller change. " + changeLogs.length + " records.")
      : t("這裡只列出這個帳戶的商品變更。共 " + changeLogs.length + " 筆。", "This account's listing changes only. " + changeLogs.length + " records.");
    if (!changeLogs.length) {
      body.innerHTML = '<tr><td colspan="5">' + escapeHtml(t("尚無後台變更紀錄。", "No change records yet.")) + "</td></tr>";
      return;
    }
    body.innerHTML = changeLogs.map(function (entry) {
      return "<tr><td class=\"is-num\">" + escapeHtml(formatTime(entry.created_at)) + "</td>" +
        "<td>" + escapeHtml(entry.seller_name || t("賣家", "Seller")) + "</td>" +
        "<td class=\"is-item\">" + escapeHtml(entry.product_label || "") + "</td>" +
        "<td class=\"is-num\">" + escapeHtml(changeAction(entry)) + "</td>" +
        '<td class="is-detail">' + changeDetail(entry) + "</td></tr>";
    }).join("");
  }

  function cartLines() {
    var cart = readCart();
    return Object.keys(cart).map(function (id) {
      var product = productById(id);
      if (!product) return null;
      return { product: product, quantity: Number(cart[id]) || 0 };
    }).filter(function (line) { return line && line.quantity > 0; });
  }

  function cartThumb(product) {
    if (product.image_url) {
      return '<img src="' + escapeHtml(product.image_url) + '" alt="">';
    }
    return '<span class="market-thumb">' + escapeHtml(t("無圖片", "No image")) + "</span>";
  }

  function cartCharge(lines) {
    var subtotal = lines.reduce(function (sum, line) {
      return sum + line.product.price * line.quantity;
    }, 0);
    var sellers = {};
    lines.forEach(function (line) {
      sellers[line.product.seller_id || ""] = true;
    });
    var sellerCount = Object.keys(sellers).length;
    return { subtotal: subtotal, platformFee: sellerCount ? fee * sellerCount : 0 };
  }

  function rememberCartPicks(lines) {
    var alive = {};
    lines.forEach(function (line) {
      var id = line.product.id;
      alive[id] = true;
      if (!Object.prototype.hasOwnProperty.call(cartPicked, id)) cartPicked[id] = true;
    });
    Object.keys(cartPicked).forEach(function (id) {
      if (!alive[id]) delete cartPicked[id];
    });
  }

  function selectedLines() {
    var lines = cartLines();
    rememberCartPicks(lines);
    return lines.filter(function (line) { return cartPicked[line.product.id]; });
  }

  function chargeSummary(charge, shipping) {
    return '<div class="swap-fee-lines">' +
      '<p class="swap-fee-line">' + escapeHtml(t("商品金額 ", "Items ") + money(charge.subtotal)) + "</p>" +
      '<p class="swap-fee-line">' + escapeHtml(t("平台手續費 ", "Platform fee ") + money(charge.platformFee)) + "</p>" +
      (shipping
        ? '<p class="swap-fee-line">' + escapeHtml(t("運費 ", "Shipping ") + money(shipping)) + "</p>"
        : "") +
      "</div>";
  }

  function renderCart() {
    var host = document.getElementById("market-cart");
    var lines = cartLines();
    rememberCartPicks(lines);
    if (!lines.length) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("購物車是空的。", "Your cart is empty.")) + "</p>";
      return;
    }
    var chosen = selectedLines();
    var charge = cartCharge(chosen);
    host.innerHTML =
      '<div class="market-cart-tools">' +
      '<button type="button" class="btn btn-outline" data-cart-select-all>' + t("全選", "Select all") + "</button>" +
      "</div>" +
      '<div class="admin-news-table-wrap"><table class="admin-news-table market-cart-table"><thead><tr>' +
      "<th>" + t("選取", "Select") + "</th>" +
      "<th>" + t("商品圖片", "Image") + "</th>" +
      "<th>" + t("商品名稱", "Product name") + "</th>" +
      "<th>" + t("數量", "Quantity") + "</th>" +
      "<th>" + t("金額", "Amount") + "</th>" +
      "<th>" + t("修改", "Edit") + "</th>" +
      "<th>" + t("刪除", "Delete") + "</th>" +
      "</tr></thead><tbody>" +
      lines.map(function (line) {
        var maxQty = Math.max(1, Number(line.product.quantity) || 1);
        var editing = cartEditId === line.product.id;
        var quantityCell = editing
          ? '<input data-cart-qty="' + line.product.id + '" type="number" min="1" max="' + maxQty + '" value="' +
            Math.min(line.quantity, maxQty) + '">'
          : String(line.quantity);
        var editCell = editing
          ? '<button type="button" class="btn btn-outline" data-cart-save="' + line.product.id + '">' + t("儲存", "Save") + "</button>"
          : '<button type="button" class="btn btn-outline" data-cart-edit="' + line.product.id + '">' + t("修改", "Edit") + "</button>";
        var pick = '<input type="checkbox" data-cart-pick="' + line.product.id + '" aria-label="' +
          escapeHtml(t("選取 ", "Select ") + productTitle(line.product)) + '"' +
          (cartPicked[line.product.id] ? " checked" : "") + ">";
        return '<tr><td class="market-pick">' + pick + "</td><td>" + cartThumb(line.product) + "</td><td>" +
          escapeHtml(productTitle(line.product)) + "</td><td>" + quantityCell + "</td><td>" +
          escapeHtml(money(line.product.price * line.quantity)) + "</td><td>" + editCell + "</td><td>" +
          '<button type="button" class="btn btn-outline" data-remove="' + line.product.id + '">' +
          t("刪除", "Delete") + "</button></td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      (chosen.length
        ? ""
        : '<p class="swap-note">' + escapeHtml(t("請勾選要下單的商品。", "Select the items you want to order.")) + "</p>") +
      chargeSummary(charge, 0) +
      '<p class="market-cart-total">' + escapeHtml(t("總金額 ", "Total ") + money(charge.subtotal + charge.platformFee)) + "</p>" +
      '<button type="button" class="btn btn-gold" id="market-to-pay">' + t("確認下單", "Confirm order") + "</button>";
  }

  function paySummary(charge, shipping) {
    return '<div class="swap-fee-lines">' +
      '<p class="swap-fee-line">' + escapeHtml(t("商品金額 ", "Items ") + money(charge.subtotal)) + "</p>" +
      '<p class="swap-fee-line">' + escapeHtml(t("平台費用 ", "Platform fee ") + money(charge.platformFee)) + "</p>" +
      '<p class="swap-fee-line">' + escapeHtml(t("運費 ", "Shipping ") + money(shipping)) + "</p>" +
      "</div>";
  }

  function renderPay() {
    var host = document.getElementById("market-pay");
    var lines = selectedLines();
    if (!lines.length) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("請先勾選要下單的商品。", "Select the items you want to order.")) + "</p>";
      return;
    }
    var charge = cartCharge(lines);
    host.innerHTML =
      '<p class="market-note">' + escapeHtml(t(
        "這是課程示範的付款畫面，不會真的扣款。送出後，賣家會在賣家模式確認收款。",
        "This is a course-demo payment screen. No real charge is made. After you submit, the seller confirms the payment in seller mode."
      )) + "</p>" +
      '<div class="admin-news-table-wrap"><table class="admin-news-table market-cart-table market-pay-table"><thead><tr>' +
      "<th>" + t("商品圖片", "Image") + "</th>" +
      "<th>" + t("商品名稱", "Product name") + "</th>" +
      "<th>" + t("數量", "Quantity") + "</th>" +
      "<th>" + t("商品金額", "Item amount") + "</th>" +
      "</tr></thead><tbody>" +
      lines.map(function (line) {
        return "<tr><td>" + cartThumb(line.product) + "</td><td>" + escapeHtml(productTitle(line.product)) +
          "</td><td>" + line.quantity + "</td><td>" +
          escapeHtml(money(line.product.price * line.quantity)) + "</td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      '<fieldset class="market-ship"><legend>' + t("運送方式", "Shipping method") + "</legend>" +
      '<label><input type="radio" name="market-ship" value="pickup" checked> ' + escapeHtml(shippingLabel("pickup")) + "</label>" +
      '<label><input type="radio" name="market-ship" value="delivery"> ' + escapeHtml(shippingLabel("delivery")) + "</label>" +
      '<p class="swap-note" id="market-pickup-note">' + escapeHtml(pickupMeetText()) + "</p>" +
      '<div id="market-delivery" class="market-delivery" hidden>' +
      '<label><span>' + t("收件人", "Recipient") + '</span><input id="market-recipient" type="text" maxlength="80" autocomplete="name"></label>' +
      '<label><span>' + t("連絡電話", "Phone") + '</span><input id="market-phone" type="tel" maxlength="30" autocomplete="tel"></label>' +
      '<label><span>' + t("收件地址", "Address") + '</span><textarea id="market-address" rows="3" maxlength="300" autocomplete="street-address"></textarea></label>' +
      "</div></fieldset>" +
      paySummary(charge, 0) +
      '<p id="market-pay-total" class="market-cart-total">' + escapeHtml(t("應付金額 ", "Total ") + money(charge.subtotal + charge.platformFee)) + "</p>" +
      '<div class="market-form-actions">' +
      '<button type="button" class="btn btn-outline" id="market-pay-back">' + t("返回購物車", "Back to cart") + "</button>" +
      '<button type="button" class="btn btn-gold" id="market-checkout">' + t("確認付款", "Confirm payment") + "</button></div>";
    host.querySelectorAll('input[name="market-ship"]').forEach(function (input) {
      input.addEventListener("change", function () {
        var delivery = input.value === "delivery";
        var ship = delivery ? 80 : 0;
        var box = document.getElementById("market-delivery");
        var meetup = document.getElementById("market-pickup-note");
        if (box) box.hidden = !delivery;
        if (meetup) meetup.hidden = delivery;
        var summary = host.querySelector(".swap-fee-lines");
        if (summary) summary.outerHTML = paySummary(charge, ship);
        document.getElementById("market-pay-total").textContent =
          t("應付金額 ", "Total ") + money(charge.subtotal + charge.platformFee + ship);
      });
    });
  }

  function orderCard(order, actions, audience) {
    var who = audience === "buyer"
      ? "<p>" + escapeHtml(t("賣家：", "Seller: ") + (order.seller_name || order.seller_email || "—")) + "</p>"
      : audience === "seller"
        ? "<p>" + escapeHtml(t("買家：", "Buyer: ") + (order.buyer_name || order.buyer_email || "—") + " · " + (order.buyer_email || "")) + "</p>"
        : "<p>" + escapeHtml(t("買家：", "Buyer: ") + (order.buyer_name || order.buyer_email || "—") + " · " + (order.buyer_email || "")) + "</p>" +
          "<p>" + escapeHtml(t("賣家：", "Seller: ") + (order.seller_name || order.seller_email || "—")) + "</p>";
    var moneyLine = audience === "admin"
      ? t("小計 ", "Subtotal ") + money(order.subtotal) +
        t("，運費 ", ", Shipping ") + money(order.shipping_fee) +
        t("，平台手續費 ", ", Platform fee ") + money(order.platform_fee) +
        t("，應付 ", ", amount due ") + money(order.total)
      : shippingLabel(order.shipping_method) + " · " + t("訂單總額 ", "Order total ") + money(order.total);
    return (
      '<article class="market-order">' +
      "<p><strong>" + escapeHtml(t("訂單編號", "Order ID")) + "</strong> " + escapeHtml(order.id) + "</p>" +
      "<p>" + escapeHtml(itemNames(order) || "—") + "</p>" +
      who +
      "<p>" + escapeHtml(moneyLine) + "</p>" +
      "<p>" + escapeHtml(t("狀態：", "Status: ") + statusLabel(order.status) + " · " + formatTime(order.updated_at || order.created_at)) + "</p>" +
      (actions || "") +
      "</article>"
    );
  }

  function buyerStatus(status) {
    if (status === "shipped") return { key: "shipped", zh: "已出貨", en: "Shipped" };
    if (status === "arrived") return { key: "arrived", zh: "已到貨", en: "Arrived" };
    if (status === "completed") return { key: "done", zh: "已完成", en: "Completed" };
    return { key: "placed", zh: "已下單", en: "Order placed" };
  }
  function orderItems(order) {
    return order.market_order_items || [];
  }
  function itemTitle(item) {
    var zh = item.product_name_zh || "";
    var en = item.product_name_en || item.product_name || "";
    return (isEn() ? (en || zh) : (zh || en)) || "—";
  }
  function itemImage(item) {
    var product = item.product_id ? productById(item.product_id) : null;
    if (product && product.image_url) {
      return '<img src="' + escapeHtml(product.image_url) + '" alt="' + escapeHtml(itemTitle(item)) + '">';
    }
    return '<span class="market-thumb">' + escapeHtml(t("無圖片", "No image")) + "</span>";
  }
  function orderHeadline(order) {
    var items = orderItems(order);
    if (!items.length) return "—";
    var first = itemTitle(items[0]);
    if (items.length === 1) return first;
    return first + t(" 等 " + items.length + " 項", " + " + (items.length - 1) + " more");
  }
  function orderQty(order) {
    return orderItems(order).reduce(function (sum, item) {
      return sum + (Number(item.quantity) || 0);
    }, 0);
  }
  function orderOverview(order) {
    var rows = orderItems(order).map(function (item) {
      return "<tr><td>" + itemImage(item) + "</td><td>" + escapeHtml(itemTitle(item)) +
        "</td><td>" + (Number(item.quantity) || 0) + "</td><td>" +
        escapeHtml(money((Number(item.unit_price) || 0) * (Number(item.quantity) || 0))) + "</td></tr>";
    }).join("");
    return '<section class="market-order-overview">' +
      '<div class="admin-list-head"><h3>' + escapeHtml(t("商品總覽", "Items in this order")) + "</h3>" +
      '<button type="button" class="btn btn-outline" data-order-overview-close>' + escapeHtml(t("關閉", "Close")) + "</button></div>" +
      "<p>" + escapeHtml(t("訂單編號 ", "Order no. ") + order.id) + "</p>" +
      '<div class="admin-news-table-wrap"><table class="admin-news-table market-orders-table"><thead><tr>' +
      "<th>" + t("商品圖片", "Image") + "</th><th>" + t("商品名稱", "Product") + "</th><th>" +
      t("數量", "Qty") + "</th><th>" + t("金額", "Amount") + "</th></tr></thead><tbody>" +
      (rows || "<tr><td colspan=\"4\">—</td></tr>") +
      "</tbody></table></div></section>";
  }

  function orderDetail(order, closeAttr) {
    var lines = orderItems(order).map(function (item) {
      var qty = Number(item.quantity) || 0;
      var amount = (Number(item.unit_price) || 0) * qty;
      return '<article class="order-detail-item">' +
        itemImage(item) +
        "<div><strong>" + escapeHtml(itemTitle(item)) + "</strong></div>" +
        '<span class="order-detail-qty">× ' + qty + "</span>" +
        '<strong class="order-detail-price">' + escapeHtml(money(amount)) + "</strong></article>";
    }).join("");
    return '<section class="order-detail">' +
      "<header><button type=\"button\" class=\"order-detail-back\" " + (closeAttr || "data-admin-detail-close") + ">" +
      escapeHtml(t("← 返回", "← Back")) + "</button><h3>" +
      escapeHtml(t("訂單詳情", "Order details")) + "</h3></header>" +
      '<p class="order-detail-code">' + escapeHtml(orderCode(order) + " · " + orderBadge(order)) + "</p>" +
      (order.cancel_reason
        ? '<p class="order-detail-reason"><span>' + escapeHtml(t("取消原因", "Cancellation reason")) + "</span><strong>" +
          escapeHtml(cancelReasonLabel(order.cancel_reason) || "—") + "</strong></p>"
        : "") +
      fulfillmentNote(order) +
      (lines || '<p class="market-empty">—</p>') +
      '<dl class="order-detail-sums">' +
      "<div><dt>" + escapeHtml(t("商品總金額", "Items")) + "</dt><dd>" + escapeHtml(money(order.subtotal)) + "</dd></div>" +
      "<div><dt>" + escapeHtml(t("運費", "Shipping")) + "</dt><dd>" + escapeHtml(money(order.shipping_fee)) + "</dd></div>" +
      "<div><dt>" + escapeHtml(t("平台手續費", "Platform fee")) + "</dt><dd>" + escapeHtml(money(order.platform_fee)) + "</dd></div>" +
      "</dl>" +
      '<p class="order-detail-total"><span>' + escapeHtml(t("訂單金額", "Order total")) + "</span><strong>" +
      escapeHtml(money(order.total)) + "</strong></p></section>";
  }
  function stepIndex(status) {
    if (status === "awaiting_payment") return 1;
    if (status === "payment_confirmed") return 2;
    if (status === "ready_to_ship") return 3;
    if (status === "shipped" || status === "arrived") return 4;
    if (status === "completed") return 5;
    return 0;
  }

  function cancelReasonLabel(reason) {
    if (reason === "not_wanted") return t("不想購買", "I no longer want this");
    if (reason === "too_expensive") return t("價格太貴", "The price is too high");
    if (reason === "wrong_address") return t("地址錯誤(需修改訂單)", "Wrong address (the order needs a change)");
    return "";
  }

  function canBuyerCancel(order) {
    return !order.cancel_reason && (
      order.status === "awaiting_payment" || order.status === "payment_confirmed" || order.status === "ready_to_ship"
    );
  }

  function buyerCancel(order) {
    if (!canBuyerCancel(order)) return "";
    return '<div class="swap-cancel">' +
      '<button type="button" class="btn btn-outline" data-cancel-open="' + order.id + '">' +
      t("取消下單", "Cancel order") + "</button>" +
      '<select class="swap-cancel-reason" hidden data-cancel-reason="' + order.id + '" aria-label="' +
      escapeHtml(t("取消原因", "Cancellation reason")) + '">' +
      '<option value="">' + escapeHtml(t("請選擇原因", "Choose a reason")) + "</option>" +
      '<option value="not_wanted">' + escapeHtml(t("不想購買", "I no longer want this")) + "</option>" +
      '<option value="too_expensive">' + escapeHtml(t("價格太貴", "The price is too high")) + "</option>" +
      '<option value="wrong_address">' + escapeHtml(t("地址錯誤(需修改訂單)", "Wrong address (the order needs a change)")) + "</option>" +
      "</select></div>";
  }

  function statusSteps(status) {
    if (status === "cancelled") return "";
    var steps = [
      ["已下單", "Order placed"],
      ["待確認付款", "Waiting for payment confirmation"],
      ["已確認付款", "Payment confirmed"],
      ["待出貨", "Ready to ship"],
      ["已出貨", "Shipped"],
      ["已完成", "Completed"]
    ];
    var current = stepIndex(status);
    return '<ol class="swap-steps">' + steps.map(function (step, index) {
      var state = index < current ? "is-done" : index === current ? "is-now" : "";
      return '<li class="' + state + '">' + escapeHtml(t(step[0], step[1])) + "</li>";
    }).join("") + "</ol>";
  }

  function orderLines(order) {
    return orderItems(order).map(function (item) {
      return "<p>" + escapeHtml(itemTitle(item) + " × " + (Number(item.quantity) || 0)) +
        "<strong>" + escapeHtml(money((Number(item.unit_price) || 0) * (Number(item.quantity) || 0))) + "</strong></p>";
    }).join("");
  }

  function swapOrder(order, actions, audience) {
    var who = audience === "buyer"
      ? t("賣家：", "Seller: ") + (order.seller_name || "—")
      : t("買家：", "Buyer: ") + (order.buyer_name || "—");
    if (audience === "admin") {
      who = t("買家：", "Buyer: ") + (order.buyer_name || "—") + " · " + t("賣家：", "Seller: ") + (order.seller_name || "—");
    }
    return (
      '<article class="swap-order">' +
      '<header><strong title="' + escapeHtml(order.id) + '">' + escapeHtml(orderCode(order)) + "</strong>" +
      "<span>" + escapeHtml(orderBadge(order)) + "</span></header>" +
      "<p>" + escapeHtml(who + " · " + t("下單 ", "Placed ") + formatTime(order.created_at)) + "</p>" +
      (cancelRequested(order) ? "" : statusSteps(order.status)) +
      (order.cancel_reason
        ? '<p class="swap-note">' + escapeHtml(t("取消原因：", "Cancellation reason: ") + (cancelReasonLabel(order.cancel_reason) || "—")) +
          (cancelRequested(order) ? "<br>" + escapeHtml(t("等待賣家確認取消。", "Waiting for the seller to confirm.")) : "") + "</p>"
        : "") +
      '<div class="swap-lines">' + orderLines(order) + "</div>" +
      (order.shipping_method === "delivery"
        ? '<p class="swap-note">' + escapeHtml(t("收件人 ", "Recipient ") + (order.recipient_name || "—")) + "<br>" +
          escapeHtml(t("連絡電話 ", "Phone ") + (order.recipient_phone || "—")) + "<br>" +
          escapeHtml(t("收件地址 ", "Address ") + (order.recipient_address || "—")) + "</p>"
        : "") +
      '<p class="swap-total">' + escapeHtml(money(order.total)) + "</p>" +
      (actions ? '<div class="swap-actions">' + actions + "</div>" : "") +
      "</article>"
    );
  }
  function trackIndex(order) {
    if (!order || order.status === "cancelled" || cancelRequested(order)) return -1;
    if (order.status === "payment_confirmed" || order.status === "ready_to_ship") return 1;
    if (order.status === "shipped") return 2;
    if (order.status === "arrived" || order.status === "completed") return 3;
    return 0;
  }

  function trackTime(iso) {
    var text = formatTime(iso);
    if (!text) return "<time></time>";
    var parts = text.split(" ");
    return "<time>" + escapeHtml(parts[0] || "") + "<br>" + escapeHtml(parts[1] || "") + "</time>";
  }

  function trackEvents(order) {
    var step = trackIndex(order);
    var events = [];
    if (order.status === "cancelled") {
      events.push({ zh: "訂單已取消", en: "Order cancelled", time: order.updated_at, now: true });
    } else if (cancelRequested(order)) {
      events.push({ zh: "已申請取消，等待賣家確認", en: "Cancellation requested, waiting for the seller", time: order.updated_at, now: true });
    } else if (step >= 3) {
      events.push({ zh: "配送完成", en: "Delivered", time: order.updated_at, now: true });
    } else if (step === 2) {
      events.push({ zh: "已出貨", en: "Shipped", time: order.updated_at, now: true });
    } else if (step === 1) {
      events.push({ zh: "賣家已確認訂單", en: "Seller confirmed the order", time: order.updated_at, now: true });
    } else {
      events.push({ zh: "已下單，等待賣家確認", en: "Order placed, waiting for the seller", time: order.created_at, now: true });
    }
    if (step >= 3) events.push({ zh: "已出貨", en: "Shipped", time: "" });
    if (step >= 2) events.push({ zh: "賣家已確認訂單", en: "Seller confirmed the order", time: "" });
    if (step !== 0) events.push({ zh: "已下單", en: "Order placed", time: order.created_at });
    return events;
  }

  function trackFlow(order) {
    var current = trackIndex(order);
    var steps = [
      ["賣家已確認訂單", "Seller confirmed"],
      ["已出貨", "Shipped"],
      ["配送完成", "Delivered"]
    ];
    return '<ol class="track-steps">' + steps.map(function (step, index) {
      var n = index + 1;
      var state = current < 0 ? "" : current > n ? "is-done" : current === n ? "is-now" : "";
      return '<li class="' + state + '"><span>' + (current >= n ? "✓" : "") + "</span><strong>" +
        escapeHtml(t(step[0], step[1])) + "</strong></li>";
    }).join("") + "</ol>";
  }

  function trackLog(order) {
    return '<ol class="track-log">' + trackEvents(order).map(function (event) {
      return '<li class="' + (event.now ? "is-now" : "") + '">' +
        (event.time ? trackTime(event.time) : "<time></time>") +
        '<span class="track-rail"></span><strong>' + escapeHtml(t(event.zh, event.en)) + "</strong></li>";
    }).join("") + "</ol>";
  }

  function orderTrackCard(order) {
    var items = orderItems(order);
    var first = items[0];
    return '<article class="track-card">' +
      trackFlow(order) +
      '<div class="track-summary">' +
      (first ? itemImage(first) : '<span class="market-thumb">—</span>') +
      "<div><strong>" + escapeHtml(orderHeadline(order)) + "</strong><p>" + escapeHtml(orderCode(order)) + "</p>" +
      (order.cancel_reason
        ? "<p>" + escapeHtml(t("取消原因：", "Cancellation reason: ") + (cancelReasonLabel(order.cancel_reason) || "—")) + "</p>"
        : "") +
      (fulfillmentText(order) ? "<p>" + escapeHtml(fulfillmentText(order)) + "</p>" : "") +
      "</div>" +
      '<button type="button" class="btn btn-outline" data-member-detail="' + order.id + '">' +
      t("訂單詳情", "Order details") + "</button></div>" +
      trackLog(order) +
      "</article>";
  }

  function renderAccount() {
    var host = document.getElementById("market-account");
    if (!host) return;
    if (!me || !me.profile) {
      host.innerHTML = "";
      return;
    }
    var profile = me.profile;
    var html =
      '<article class="account-card">' +
      "<p><span>" + escapeHtml(t("帳號", "Account")) + "</span><strong>" + escapeHtml(profile.email || "—") + "</strong></p>" +
      "<p><span>" + escapeHtml(t("名字", "Name")) + "</span><strong>" + escapeHtml(profile.display_name || "—") + "</strong></p>";
    if (selling()) {
      var mine = products.filter(function (item) { return item.seller_id === uid(); });
      html += "<h3>" + escapeHtml(t("上架商品", "Listed items")) + "</h3>";
      html += mine.length
        ? '<ul class="account-products">' + mine.map(function (item) {
          return "<li><strong>" + escapeHtml(productTitle(item)) + "</strong><span>" +
            escapeHtml(t("數量 ", "Qty ") + (Number(item.quantity) || 0)) + "</span></li>";
        }).join("") + "</ul>"
        : "<p>" + escapeHtml(t("尚未上架商品。", "No listed items yet.")) + "</p>";
    }
    host.innerHTML = html + "</article>";
  }

  function renderMember() {
    var host = document.getElementById("market-member");
    if (!canBuy()) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("請先登入才能查看訂單。", "Sign in to view your orders.")) + "</p>";
      return;
    }
    var owned = orders.filter(function (order) { return order.buyer_id === uid(); });
    if (!owned.length) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("還沒有訂單。", "No orders yet.")) + "</p>";
      return;
    }
    var mine = filteredOrders(owned, "market-member-q", "market-member-status", "market-member-abnormal");
    var detail = null;
    if (memberDetailId) {
      orders.some(function (order) {
        if (order.id === memberDetailId && order.buyer_id === uid()) detail = order;
        return !!detail;
      });
    }
    if (detail) {
      host.innerHTML = '<section class="track-card">' + trackFlow(detail) + trackLog(detail) + "</section>" +
        orderDetail(detail, "data-member-detail-close") + buyerCancel(detail);
      return;
    }
    host.innerHTML = mine.length
      ? mine.map(orderTrackCard).join("")
      : '<p class="market-empty">' + escapeHtml(t("沒有符合的訂單。", "No matching orders.")) + "</p>";
  }

  function sellerAction(order) {
    if (cancelRequested(order)) {
      return '<button type="button" class="btn btn-outline" data-confirm-cancel="' + order.id + '">' +
        t("確認取消", "Confirm cancellation") + "</button>" +
        '<button type="button" class="btn btn-outline" data-advance="' + order.id + '" data-next="shipped">' +
        t("確認出貨", "Confirm shipment") + "</button>";
    }
    if (order.status === "awaiting_payment") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="payment_confirmed">' +
        t("確認付款", "Confirm payment") + "</button>";
    }
    if (order.status === "payment_confirmed" || (order.status === "ready_to_ship" && !order.ship_date)) {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="ready_to_ship">' +
        t("標記可出貨", "Mark ready") + "</button>";
    }
    if (order.status === "ready_to_ship") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="shipped">' +
        t("確認出貨", "Confirm shipment") + "</button>";
    }
    if (order.status === "shipped") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="arrived">' +
        t("標記已到貨", "Mark as arrived") + "</button>";
    }
    if (order.status === "arrived") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="completed">' +
        t("標記訂單完成", "Mark order as completed") + "</button>";
    }
    return "";
  }

  function sellerOrderTable(list) {
    if (!list.length) {
      return '<p class="market-empty">' + escapeHtml(t("目前沒有訂單。", "There are no orders at the moment.")) + "</p>";
    }
    var rows = list.map(function (order) {
      var action = sellerAction(order);
      return "<tr><td><strong>" + escapeHtml(orderCode(order)) + "</strong></td><td>" +
        escapeHtml(order.buyer_name || "—") + "</td><td>" + escapeHtml(order.seller_name || "—") + "</td><td>" +
        escapeHtml(orderBadge(order)) + "</td><td>" + escapeHtml(money(order.total)) + "</td><td>" +
        escapeHtml(formatTime(order.created_at)) + "</td><td>" + escapeHtml(itemNames(order) || "—") +
        (fulfillmentText(order) ? "<br>" + escapeHtml(fulfillmentText(order)) : "") + "</td><td class=\"is-process\">" +
        (action ? '<div class="swap-actions">' + action + "</div>" : "—") + "</td></tr>";
    }).join("");
    return '<div class="admin-news-table-wrap"><table class="admin-news-table swap-table"><thead><tr>' +
      "<th>" + t("訂單編號", "Order no.") + "</th><th>" + t("買家", "Buyer") + "</th><th>" + t("賣家", "Seller") + "</th><th>" +
      t("狀態", "Status") + "</th><th>" + t("金額", "Amount") + "</th><th>" + t("下單時間", "Placed") + "</th><th>" +
      t("明細", "Details") + "</th><th>" + t("訂單處理狀態", "Handling") + "</th></tr></thead><tbody>" +
      rows + "</tbody></table></div>";
  }

  function renderSeller() {
    var host = document.getElementById("market-seller");
    if (!canSell()) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("買家不能處理賣家訂單。", "Buyers cannot process seller orders.")) + "</p>";
      return;
    }
    var mine = orders.filter(function (order) { return order.seller_id === uid(); });
    host.innerHTML = sellerOrderTable(mine);
    renderAccounting();
  }

  function monthKey(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var parts = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" })
      .formatToParts(date).forEach(function (part) { parts[part.type] = part.value; });
    return parts.year + "-" + parts.month;
  }

  function renderAccounting() {
    var select = document.getElementById("market-month");
    var completed = orders.filter(function (order) {
      return order.seller_id === uid() && order.status === "completed";
    });
    var months = {};
    completed.forEach(function (order) {
      var key = monthKey(order.updated_at || order.created_at);
      if (key) months[key] = true;
    });
    var keys = Object.keys(months).sort().reverse();
    var current = select.value || "all";
    select.innerHTML = '<option value="all">' + t("全部月份", "All months") + "</option>" +
      keys.map(function (key) { return '<option value="' + key + '">' + key.replace("-", "/") + "</option>"; }).join("");
    select.value = current === "all" || months[current] ? current : "all";
    var chosen = completed.filter(function (order) {
      return select.value === "all" || monthKey(order.updated_at || order.created_at) === select.value;
    });
    var revenue = chosen.reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
    document.getElementById("market-month-summary").textContent = t(
      "完成 " + chosen.length + " 筆，這個範圍的營業額 " + money(revenue),
      chosen.length + " completed orders, revenue " + money(revenue)
    );
  }

  function isAbnormal(order) {
    var stamp = new Date(order.updated_at || order.created_at).getTime();
    if (!stamp) return false;
    var days = (Date.now() - stamp) / 86400000;
    if (order.status === "awaiting_payment" && days > 3) return true;
    if ((order.status === "shipped" || order.status === "arrived") && days > 7) return true;
    return false;
  }

  function filteredOrders(list, queryId, statusId, abnormalId) {
    var queryEl = document.getElementById(queryId);
    var statusEl = document.getElementById(statusId);
    var abnormalEl = document.getElementById(abnormalId);
    var query = ((queryEl && queryEl.value) || "").trim().toLowerCase();
    var status = statusEl ? statusEl.value : "all";
    var abnormalOnly = !!(abnormalEl && abnormalEl.checked);
    return list.filter(function (order) {
      var code = (orderCode(order) + " " + order.id).toLowerCase();
      if (query && code.indexOf(query) === -1) return false;
      if (abnormalOnly && !isAbnormal(order)) return false;
      if (status === "all") return true;
      if (status === "incomplete") return order.status !== "completed" && order.status !== "cancelled";
      return order.status === status;
    });
  }

  function orderQueryTable(list, detailAttr) {
    if (!list.length) {
      return '<p class="market-empty">' + escapeHtml(t("沒有符合的交易。", "No matching transactions.")) + "</p>";
    }
    var rows = list.map(function (order) {
      return "<tr><td><strong>" + escapeHtml(orderCode(order)) + "</strong></td><td>" +
        escapeHtml(order.buyer_name || "—") + "</td><td>" + escapeHtml(order.seller_name || "—") + "</td><td>" +
        escapeHtml(orderBadge(order)) + "</td><td>" + escapeHtml(money(order.total)) + "</td><td>" +
        escapeHtml(formatTime(order.created_at)) + "</td><td>" + escapeHtml(itemNames(order) || "—") + "</td><td>" +
        '<button type="button" class="btn btn-outline" ' + detailAttr + '="' + order.id + '">' +
        t("訂單詳情", "Order details") + "</button></td></tr>";
    }).join("");
    return '<div class="admin-news-table-wrap"><table class="admin-news-table swap-table"><thead><tr>' +
      "<th>" + t("訂單編號", "Order no.") + "</th><th>" + t("買家", "Buyer") + "</th><th>" + t("賣家", "Seller") + "</th><th>" +
      t("狀態", "Status") + "</th><th>" + t("金額", "Amount") + "</th><th>" + t("下單時間", "Placed") + "</th><th>" +
      t("明細", "Details") + "</th><th>" + t("訂單詳情", "Order details") + "</th></tr></thead><tbody>" +
      rows + "</tbody></table></div>";
  }

  function exportOrderCsv(rows, filename) {
    var header = isEn()
      ? ["order_no", "buyer", "seller", "status", "total", "placed", "items"]
      : ["訂單編號", "買家", "賣家", "狀態", "金額", "下單時間", "明細"];
    var lines = [header.join(",")].concat(rows.map(function (order) {
      return [
        '"' + orderCode(order) + '"',
        '"' + (order.buyer_name || "") + '"',
        '"' + (order.seller_name || "") + '"',
        '"' + orderBadge(order) + '"',
        order.total,
        '"' + formatTime(order.created_at) + '"',
        '"' + itemNames(order).replace(/"/g, '""') + '"'
      ].join(",");
    }));
    var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function filteredAdminOrders() {
    return filteredOrders(orders, "market-order-q", "market-status-filter", "market-abnormal");
  }

  function renderAdmin() {
    if (!isAdmin()) {
      document.getElementById("market-admin-list").innerHTML = '<p class="market-empty">' + escapeHtml(t("只有管理員可以查看全平台交易。", "Only an admin can monitor platform transactions.")) + "</p>";
      return;
    }
    var list = filteredAdminOrders();
    var amount = list.reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
    var fees = list.reduce(function (sum, order) { return sum + Number(order.platform_fee || 0); }, 0);
    document.getElementById("market-admin-stats").textContent = t(
      list.length + " 筆交易 / 金額 " + money(amount) + " / 手續費 " + money(fees),
      list.length + " orders / Amount " + money(amount) + " / Fees " + money(fees)
    );
    var detail = null;
    if (adminDetailId) {
      orders.some(function (order) {
        if (order.id === adminDetailId) detail = order;
        return order.id === adminDetailId;
      });
    }
    if (detail) {
      document.getElementById("market-admin-list").innerHTML = orderDetail(detail);
      return;
    }
    document.getElementById("market-admin-list").innerHTML = orderQueryTable(list, "data-admin-detail");
  }

  function fillSelect(select, options) {
    if (!select) return;
    var value = select.value;
    select.innerHTML = options.map(function (opt) {
      return '<option value="' + escapeHtml(opt.value) + '">' + escapeHtml(t(opt.zh, opt.en)) + "</option>";
    }).join("");
    if (options.some(function (opt) { return opt.value === value; })) select.value = value;
  }

  function fillChoices() {
    fillSelect(document.getElementById("market-category-filter"), [
      { value: "all", zh: "全部分類", en: "All categories" }
    ].concat([
      { value: "Electronics", zh: "3C", en: "Electronics" },
      { value: "Books", zh: "書籍", en: "Books" },
      { value: "Daily", zh: "生活用品", en: "Daily" },
      { value: "Other", zh: "其他", en: "Other" }
    ]));
    fillSelect(document.getElementById("market-category"), [
      { value: "Electronics", zh: "3C", en: "Electronics" },
      { value: "Books", zh: "書籍", en: "Books" },
      { value: "Daily", zh: "生活用品", en: "Daily" },
      { value: "Other", zh: "其他", en: "Other" }
    ]);
    fillSelect(document.getElementById("market-listing-status"), [
      { value: "listed", zh: "上架中", en: "Listed" },
      { value: "hidden", zh: "已隱藏", en: "Hidden" },
      { value: "sold", zh: "已售出", en: "Sold" }
    ]);
    var orderStatuses = [
      { value: "all", zh: "全部", en: "All" },
      { value: "incomplete", zh: "未完成", en: "Incomplete" },
      { value: "awaiting_payment", zh: "待確認付款", en: "Waiting for payment" },
      { value: "payment_confirmed", zh: "已確認付款", en: "Payment confirmed" },
      { value: "ready_to_ship", zh: "待出貨", en: "Ready to ship" },
      { value: "shipped", zh: "已出貨", en: "Shipped" },
      { value: "arrived", zh: "已到貨", en: "Arrived" },
      { value: "completed", zh: "已完成", en: "Completed" },
      { value: "cancelled", zh: "已取消", en: "Cancelled" }
    ];
    fillSelect(document.getElementById("market-status-filter"), orderStatuses);
    fillSelect(document.getElementById("market-member-status"), orderStatuses);
    document.title = t(
      "書籍&市集 | 國際經營管理碩士班（imMBA）",
      "Books & Marketplace | International Management (imMBA)"
    );
  }

  function renderAll() {
    fillChoices();
    renderChrome();
    renderListings();
    if (view === "inventory") renderInventory();
    if (view === "changes") renderChanges();
    if (view === "cart") renderCart();
    if (view === "pay") renderPay();
    if (view === "member") renderMember();
    if (view === "seller") renderSeller();
    if (view === "admin") renderAdmin();
    if (view === "account") renderAccount();
  }

  async function refresh() {
    var sb = auth.getClient();
    var productResult = await sb.from("market_products").select("*").order("created_at", { ascending: false });
    if (productResult.error) throw productResult.error;
    products = productResult.data || [];
    orders = [];
    changeLogs = [];
    if (me) {
      var orderResult = await sb.from("market_orders").select("*, market_order_items(*)").order("created_at", { ascending: false });
      if (orderResult.error) throw orderResult.error;
      orders = orderResult.data || [];
      var logQuery = sb.from("market_change_logs").select("*").order("created_at", { ascending: false }).limit(300);
      if (!isSuper()) logQuery = logQuery.eq("seller_id", uid());
      var logResult = await logQuery;
      if (!logResult.error) changeLogs = logResult.data || [];
    }
    var feeResult = await sb.from("market_settings").select("platform_fee").eq("id", 1).maybeSingle();
    if (!feeResult.error && feeResult.data) fee = Number(feeResult.data.platform_fee) || 0;
    ready = true;
    renderAll();
  }

  var draftPhotos = [];

  function clearDraftPhotos() {
    draftPhotos.forEach(function (photo) {
      if (photo.file && photo.preview && photo.preview.indexOf("blob:") === 0) URL.revokeObjectURL(photo.preview);
    });
    draftPhotos = [];
  }

  function renderDraftPhotos() {
    var list = document.getElementById("market-photo-list");
    var count = document.getElementById("market-photo-count");
    if (count) count.textContent = t("已選 " + draftPhotos.length + " / 10 張", draftPhotos.length + " / 10 selected");
    if (!list) return;
    list.innerHTML = draftPhotos.map(function (photo, index) {
      return "<figure><img src=\"" + escapeHtml(photo.preview) + "\" alt=\"\">" +
        "<button type=\"button\" data-remove-photo=\"" + index + "\">" + t("移除", "Remove") + "</button></figure>";
    }).join("");
  }

  function translatePair() {
    if (isEn()) {
      return {
        sourceName: "market-name-en",
        targetName: "market-name-zh",
        sourceDesc: "market-description-en",
        targetDesc: "market-description-zh",
        from: "en",
        to: "zh-TW"
      };
    }
    return {
      sourceName: "market-name-zh",
      targetName: "market-name-en",
      sourceDesc: "market-description-zh",
      targetDesc: "market-description-en",
      from: "zh-TW",
      to: "en"
    };
  }

  async function translateText(text, from, to) {
    var response = await fetch(
      "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) +
      "&langpair=" + encodeURIComponent(from + "|" + to)
    );
    if (!response.ok) throw new Error("translate");
    var data = await response.json();
    var translated = data && data.responseData ? String(data.responseData.translatedText || "").trim() : "";
    if (!translated || /MYMEMORY WARNING/i.test(translated)) throw new Error("translate");
    return translated;
  }

  async function fillTranslation(sourceId, targetId, from, to) {
    var source = document.getElementById(sourceId);
    var target = document.getElementById(targetId);
    var text = source.value.trim();
    if (!text) {
      target.value = "";
      return;
    }
    var translated = await translateText(text, from, to);
    if (source.value.trim() === text) target.value = translated;
  }

  function setFieldLabel(inputId, zh, enText) {
    var input = document.getElementById(inputId);
    var label = input && input.closest("label");
    if (!label) return;
    var zhSpan = label.querySelector(".zh");
    var enSpan = label.querySelector(".en");
    if (zhSpan) zhSpan.textContent = zh;
    if (enSpan) enSpan.textContent = enText;
  }

  function applyTranslateDirection() {
    var englishPage = isEn();
    [
      ["market-name-zh", "market-description-zh"],
      ["market-name-en", "market-description-en"]
    ].forEach(function (ids, index) {
      var locked = englishPage ? index === 0 : index === 1;
      ids.forEach(function (id) {
        var field = document.getElementById(id);
        field.readOnly = locked;
        field.classList.toggle("is-synced", locked);
        if (id === "market-name-zh") field.required = !englishPage;
        if (id === "market-name-en") field.required = englishPage;
      });
    });
    if (englishPage) {
      setFieldLabel("market-name-en", "英文商品名稱", "English product name");
      setFieldLabel("market-name-zh", "中文商品名稱（自動翻譯）", "Chinese name (translated)");
      setFieldLabel("market-description-en", "英文說明", "English description");
      setFieldLabel("market-description-zh", "中文說明（自動翻譯）", "Chinese description (translated)");
    } else {
      setFieldLabel("market-name-zh", "中文商品名稱", "Chinese product name");
      setFieldLabel("market-name-en", "英文商品名稱（自動翻譯）", "English name (translated)");
      setFieldLabel("market-description-zh", "中文說明", "Chinese description");
      setFieldLabel("market-description-en", "英文說明（自動翻譯）", "English description (translated)");
    }
    applyListedIdentityLock();
  }

  function marketMember() {
    return !!(me && me.profile && (me.profile.role === "market" || me.profile.role === "both"));
  }

  function listedIdentityLocked() {
    return marketMember() && !!document.getElementById("market-product-id").value;
  }

  function applyListedIdentityLock() {
    var lock = listedIdentityLocked();
    var note = document.getElementById("market-identity-note");
    if (note) note.hidden = !lock;
    var price = document.getElementById("market-price");
    price.readOnly = lock;
    price.disabled = lock;
    price.required = !lock;
    price.classList.toggle("is-synced", lock);
    setFieldLabel(
      "market-price",
      lock ? "價格（元，不可修改）" : "價格（元）",
      lock ? "Price (locked)" : "Price (TWD)"
    );
    if (!lock) return;
    ["market-name-zh", "market-name-en"].forEach(function (id) {
      var field = document.getElementById(id);
      field.readOnly = true;
      field.required = false;
      field.classList.add("is-synced");
    });
    setFieldLabel("market-name-zh", "中文商品名稱（不可修改）", "Chinese name (locked)");
    setFieldLabel("market-name-en", "英文商品名稱（不可修改）", "English name (locked)");
  }

  function watchField(id) {
    var timer = 0;
    document.getElementById(id).addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var pair = translatePair();
        var targetId = id === pair.sourceName ? pair.targetName : (id === pair.sourceDesc ? pair.targetDesc : "");
        if (!targetId) return;
        fillTranslation(id, targetId, pair.from, pair.to).catch(function () {});
      }, 450);
    });
  }

  async function uploadProductPhoto(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type || "")) {
      throw new Error(t("只接受 JPG、PNG、WEBP 或 GIF。", "Use a JPG, PNG, WEBP, or GIF image."));
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(t("圖片需小於 5 MB。", "The image must be 5 MB or smaller."));
    }
    var ext = "jpg";
    if (file.type === "image/png") ext = "png";
    if (file.type === "image/webp") ext = "webp";
    if (file.type === "image/gif") ext = "gif";
    var path = uid() + "/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    var uploaded = await auth.getClient().storage.from("market-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (uploaded.error) throw new Error(uploaded.error.message || t("照片上傳失敗。", "Could not upload the photo."));
    var pub = auth.getClient().storage.from("market-photos").getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : "";
    if (!url) throw new Error(t("照片上傳失敗。", "Could not upload the photo."));
    return url;
  }

  function openForm(product) {
    document.getElementById("market-form").hidden = false;
    document.getElementById("market-product-id").value = product ? product.id : "";
    document.getElementById("market-name-zh").value = product ? (product.name_zh || "") : "";
    document.getElementById("market-name-en").value = product ? (product.name_en || product.name || "") : "";
    document.getElementById("market-category").value = product ? product.category : "Other";
    document.getElementById("market-description-zh").value = product ? (product.description_zh || "") : "";
    document.getElementById("market-description-en").value = product ? (product.description_en || product.description || "") : "";
    document.getElementById("market-price").value = product ? product.price : "";
    document.getElementById("market-quantity").value = product ? product.quantity : 1;
    document.getElementById("market-image").value = "";
    document.getElementById("market-photo").value = "";
    clearDraftPhotos();
    draftPhotos = productPhotos(product).map(function (url) {
      return { file: null, preview: url, url: url };
    });
    renderDraftPhotos();
    document.getElementById("market-video").value = product && product.video_url ? product.video_url : "";
    document.getElementById("market-listing-status").value = product ? product.status : "listed";
    document.getElementById("market-form-title").innerHTML = product
      ? '<span class="zh">編輯商品</span><span class="en">Edit item</span>'
      : '<span class="zh">新增商品</span><span class="en">Add new item</span>';
    applyTranslateDirection();
    document.getElementById("market-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!canSell()) {
      showStatus("買家不能上架或修改商品。", "Buyers cannot list or edit products.", "err");
      return;
    }
    var id = document.getElementById("market-product-id").value;
    var keepIdentity = !!(id && marketMember());
    var existing = keepIdentity ? productById(id) : null;
    if (keepIdentity && (!existing || existing.seller_id !== uid())) return;
    try {
      var pair = translatePair();
      if (!keepIdentity) await fillTranslation(pair.sourceName, pair.targetName, pair.from, pair.to);
      await fillTranslation(pair.sourceDesc, pair.targetDesc, pair.from, pair.to);
    } catch (err) {
      showStatus("翻譯失敗，請再試一次。", "Could not translate. Please try again.", "err");
      return;
    }
    var nameZh = existing ? String(existing.name_zh || "").trim() : document.getElementById("market-name-zh").value.trim();
    var nameEn = existing ? String(existing.name_en || existing.name || "").trim() : document.getElementById("market-name-en").value.trim();
    if (draftPhotos.length > 10) {
      showStatus("最多只能選 10 張照片。", "You can choose up to 10 photos.", "err");
      return;
    }
    var imageUrls = [];
    try {
      for (var photoIndex = 0; photoIndex < draftPhotos.length; photoIndex += 1) {
        var draft = draftPhotos[photoIndex];
        imageUrls.push(draft.file ? await uploadProductPhoto(draft.file) : draft.url);
      }
    } catch (err) {
      showStatus(err.message || "照片上傳失敗。", err.message || "Could not upload the photo.", "err");
      return;
    }
    var imageUrl = imageUrls[0] || null;
    var record = {
      name: existing && existing.name ? existing.name : (nameEn || nameZh),
      name_zh: nameZh,
      name_en: nameEn,
      category: document.getElementById("market-category").value,
      description: document.getElementById("market-description-en").value.trim(),
      description_zh: document.getElementById("market-description-zh").value.trim(),
      description_en: document.getElementById("market-description-en").value.trim(),
      price: existing ? Number(existing.price) : Number(document.getElementById("market-price").value),
      quantity: Number(document.getElementById("market-quantity").value),
      image_url: imageUrl,
      image_urls: imageUrls,
      video_url: document.getElementById("market-video").value.trim() || null,
      status: document.getElementById("market-listing-status").value
    };
    if (!nameZh || !nameEn || record.price < 0 || record.quantity < 0) {
      showStatus("請填寫中文名稱、英文名稱、價格與數量。", "Enter the Chinese name, English name, price, and quantity.", "err");
      return;
    }
    var sb = auth.getClient();
    var result = id
      ? await sb.from("market_products").update(record).eq("id", id).eq("seller_id", uid()).select().maybeSingle()
      : await sb.from("market_products").insert(Object.assign(record, {
          seller_id: uid(),
          seller_name: me.profile.display_name || "",
          seller_email: me.profile.email || ""
        })).select().maybeSingle();
    if (result.error) {
      showStatus("儲存失敗：" + result.error.message, "Save failed: " + result.error.message, "err");
      return;
    }
    var saved = result.data || {};
    await logMarket({
      action: id ? "UPDATE" : "CREATE",
      entity_type: "market_product",
      entity_id: saved.id || id,
      entity_label: nameZh || nameEn,
      summary: id ? "updated" : "created"
    });
    setView("inventory");
    showStatus("商品已儲存，瀏覽商品已同步。", "Item saved. Browse is updated.", "ok");
    await refresh();
  }

  async function addSamples() {
    if (!canSell()) return;
    var sb = auth.getClient();
    var existing = {};
    products.forEach(function (item) {
      if (item.seller_id !== uid()) return;
      existing[item.name_en || item.name] = true;
      existing[item.name] = true;
    });
    var rows = SAMPLES.filter(function (item) { return !existing[item.name_en]; }).map(function (item) {
      return Object.assign({
        seller_id: uid(),
        seller_name: me.profile.display_name || "",
        seller_email: me.profile.email || "",
        name: item.name_en,
        description: item.description_en,
        status: "listed"
      }, item);
    });
    if (!rows.length) {
      showStatus("範例商品已經在你的上架清單裡。", "The sample items are already in your listings.", "ok");
      return;
    }
    var result = await sb.from("market_products").insert(rows);
    if (result.error) {
      showStatus("載入失敗：" + result.error.message, "Could not load samples: " + result.error.message, "err");
      return;
    }
    showStatus("已載入簡報上的範例商品。", "Loaded the sample items from the slides.", "ok");
    await refresh();
  }

  applyTranslateDirection();
  ["market-name-zh", "market-name-en", "market-description-zh", "market-description-en"].forEach(watchField);
  document.getElementById("market-photo").addEventListener("change", function () {
    var input = this;
    var files = Array.prototype.slice.call(input.files || []);
    input.value = "";
    if (!files.length) return;
    if (draftPhotos.length + files.length > 10) {
      showStatus("最多只能選 10 張照片。", "You can choose up to 10 photos.", "err");
      return;
    }
    for (var fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      var picked = files[fileIndex];
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(picked.type || "")) {
        showStatus("只接受 JPG、PNG、WEBP 或 GIF。", "Use a JPG, PNG, WEBP, or GIF image.", "err");
        return;
      }
      if (picked.size > 5 * 1024 * 1024) {
        showStatus("每張圖片需小於 5 MB。", "Each image must be 5 MB or smaller.", "err");
        return;
      }
    }
    files.forEach(function (file) {
      draftPhotos.push({ file: file, preview: URL.createObjectURL(file), url: "" });
    });
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    statusNote = null;
    paintStatus();
    renderDraftPhotos();
  });
  document.getElementById("market-form").addEventListener("submit", saveProduct);
  document.getElementById("market-form-cancel").addEventListener("click", function () {
    setView("inventory");
    renderChrome();
  });
  var stockEditId = "";
  function openStockDialog(item) {
    stockEditId = item.id;
    document.getElementById("market-stock-name").textContent = productTitle(item);
    document.getElementById("market-stock-qty").value = String(Number(item.quantity) || 0);
    var note = document.getElementById("market-stock-status");
    note.hidden = true;
    note.textContent = "";
    var dialog = document.getElementById("market-stock-dialog");
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }
  function closeStockDialog() {
    var dialog = document.getElementById("market-stock-dialog");
    if (dialog && dialog.open) dialog.close();
  }
  async function applyStockChoice(unlist) {
    var item = productById(stockEditId);
    var note = document.getElementById("market-stock-status");
    if (!canSell() || !item || item.seller_id !== uid()) return;
    var qtyField = document.getElementById("market-stock-qty");
    var qty = Number(qtyField.value);
    if (!unlist && (qtyField.value === "" || qty < 0)) return;
    var patch = unlist ? { status: "hidden" } : { quantity: qty, status: "listed" };
    var result = await auth.getClient().from("market_products").update(patch).eq("id", item.id).eq("seller_id", uid());
    if (result.error) {
      note.hidden = false;
      note.textContent = t("更新失敗：" + result.error.message, "Could not update: " + result.error.message);
      return;
    }
    await logMarket({
      action: "UPDATE",
      entity_type: "market_product",
      entity_id: item.id,
      entity_label: productTitle(item),
      summary: unlist ? "unlisted" : "listed quantity " + qty
    });
    closeStockDialog();
    showStatus(
      unlist ? "商品已下架，瀏覽商品已同步。" : "上架數量已更新，瀏覽商品已同步。",
      unlist ? "Item unlisted. Browse is updated." : "Listed quantity updated. Browse is updated.",
      "ok"
    );
    await refresh();
  }
  document.getElementById("market-stock-form").addEventListener("submit", function (event) {
    event.preventDefault();
    applyStockChoice(false);
  });
  document.getElementById("market-stock-hide").addEventListener("click", function () {
    applyStockChoice(true);
  });
  document.getElementById("market-stock-cancel").addEventListener("click", closeStockDialog);
  document.getElementById("market-stock-dialog").addEventListener("cancel", function (event) {
    event.preventDefault();
    closeStockDialog();
  });
  var shipEditId = "";
  var shipOrderDay = "";
  function taipeiDate(iso) {
    var parts = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(iso ? new Date(iso) : new Date()).forEach(function (part) { parts[part.type] = part.value; });
    return parts.year + "-" + parts.month + "-" + parts.day;
  }
  function addDays(isoDate, days) {
    var bits = isoDate.split("-");
    var utc = new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2])));
    utc.setUTCDate(utc.getUTCDate() + days);
    var month = String(utc.getUTCMonth() + 1);
    var day = String(utc.getUTCDate());
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return utc.getUTCFullYear() + "-" + month + "-" + day;
  }
  function earliestArrival(shipValue) {
    var nextDay = addDays(shipOrderDay, 1);
    if (shipValue && shipValue > nextDay) return shipValue;
    return nextDay;
  }
  function openShipDialog(orderId) {
    var order = null;
    orders.some(function (item) {
      if (item.id === orderId) order = item;
      return !!order;
    });
    if (!order || (order.status !== "payment_confirmed" && !(order.status === "ready_to_ship" && !order.ship_date))) return;
    shipEditId = order.id;
    shipOrderDay = taipeiDate(order.created_at);
    document.getElementById("market-ship-order").textContent = orderCode(order) + " · " + (itemNames(order) || "");
    document.getElementById("market-ship-pickup").hidden = order.shipping_method !== "pickup";
    var today = taipeiDate();
    var shipInput = document.getElementById("market-ship-date");
    var arriveInput = document.getElementById("market-arrive-date");
    var shipDefault = today < shipOrderDay ? shipOrderDay : today;
    var arriveDefault = earliestArrival(shipDefault);
    shipInput.min = shipOrderDay;
    shipInput.value = shipDefault;
    arriveInput.min = arriveDefault;
    arriveInput.value = arriveDefault;
    var note = document.getElementById("market-ship-status");
    note.hidden = true;
    note.textContent = "";
    var dialog = document.getElementById("market-ship-dialog");
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }
  function closeShipDialog() {
    var dialog = document.getElementById("market-ship-dialog");
    if (dialog && dialog.open) dialog.close();
    shipEditId = "";
    shipOrderDay = "";
  }
  document.getElementById("market-ship-date").addEventListener("change", function () {
    var arriveInput = document.getElementById("market-arrive-date");
    if (shipOrderDay && this.value && this.value < shipOrderDay) this.value = shipOrderDay;
    var floor = earliestArrival(this.value);
    arriveInput.min = floor;
    if (!arriveInput.value || arriveInput.value < floor) arriveInput.value = floor;
  });
  document.getElementById("market-ship-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var note = document.getElementById("market-ship-status");
    var shipDate = document.getElementById("market-ship-date").value;
    var arriveDate = document.getElementById("market-arrive-date").value;
    var floor = earliestArrival(shipDate);
    if (!shipEditId || !shipDate || !arriveDate || shipDate < shipOrderDay || arriveDate < floor) {
      note.hidden = false;
      note.textContent = t("出貨日最早為下單當天，抵達日最早為下單隔天。", "The earliest ship date is the order day. Arrival starts the next day.");
      return;
    }
    var advanced = await auth.getClient().rpc("advance_market_order", {
      p_order: shipEditId,
      p_next: "ready_to_ship",
      p_ship_date: shipDate,
      p_arrival_date: arriveDate
    });
    if (advanced.error) {
      note.hidden = false;
      note.textContent = t("狀態更新失敗：" + advanced.error.message, "Could not update the order: " + advanced.error.message);
      return;
    }
    var savedId = shipEditId;
    closeShipDialog();
    showStatus("已標記可出貨，並記錄出貨日期與抵達日期。", "Marked ready to ship, with the ship date and arrival date saved.", "ok");
    await logMarket({
      action: "UPDATE",
      entity_type: "market_order",
      entity_id: savedId,
      entity_label: savedId,
      summary: "ready to ship " + shipDate + " to " + arriveDate
    });
    await refresh();
    setView("seller");
  });
  document.getElementById("market-ship-cancel").addEventListener("click", closeShipDialog);
  document.getElementById("market-ship-dialog").addEventListener("cancel", function (event) {
    event.preventDefault();
    closeShipDialog();
  });
  document.getElementById("market-seed").addEventListener("click", addSamples);
  ["market-search", "market-min", "market-max"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", renderListings);
  });
  document.getElementById("market-instock").addEventListener("change", renderListings);
  document.getElementById("market-clear-filters").addEventListener("click", function () {
    document.getElementById("market-search").value = "";
    document.getElementById("market-min").value = "";
    document.getElementById("market-max").value = "";
    document.getElementById("market-instock").checked = false;
    document.getElementById("market-category-filter").value = "all";
    renderListings();
  });
  document.getElementById("market-locale").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-locale") === "en" ? "zh" : "en";
    document.documentElement.lang = next === "en" ? "en" : "zh-Hant";
    document.documentElement.setAttribute("data-locale", next);
    localStorage.setItem("immba-locale", next);
    applyTranslateDirection();
    if (ready) renderAll();
  });
  document.getElementById("market-signout").addEventListener("click", async function () {
    await auth.signOut();
    location.href = "books.html";
  });
  document.getElementById("market-abnormal").addEventListener("change", renderAdmin);
  document.getElementById("market-member-q").addEventListener("input", renderMember);
  document.getElementById("market-member-status").addEventListener("change", renderMember);
  document.getElementById("market-member-abnormal").addEventListener("change", renderMember);
  document.getElementById("market-member-clear").addEventListener("click", function () {
    document.getElementById("market-member-q").value = "";
    document.getElementById("market-member-status").value = "all";
    document.getElementById("market-member-abnormal").checked = false;
    memberDetailId = "";
    renderMember();
  });
  document.getElementById("market-member-export").addEventListener("click", function () {
    var rows = filteredOrders(orders.filter(function (order) {
      return order.buyer_id === uid();
    }), "market-member-q", "market-member-status", "market-member-abnormal");
    exportOrderCsv(rows, "my-orders.csv");
  });
  document.getElementById("market-admin-clear").addEventListener("click", function () {
    document.getElementById("market-order-q").value = "";
    document.getElementById("market-status-filter").value = "all";
    document.getElementById("market-abnormal").checked = false;
    renderAdmin();
  });
  document.getElementById("market-admin-export").addEventListener("click", function () {
    exportOrderCsv(filteredAdminOrders(), "market-query.csv");
  });
  document.getElementById("market-category-filter").addEventListener("change", renderListings);
  document.getElementById("market-month").addEventListener("change", renderAccounting);
  document.getElementById("market-order-q").addEventListener("input", renderAdmin);
  document.getElementById("market-status-filter").addEventListener("change", renderAdmin);
  document.getElementById("market-export").addEventListener("click", function () {
    var select = document.getElementById("market-month");
    var rows = orders.filter(function (order) {
      if (order.seller_id !== uid() || order.status !== "completed") return false;
      return !select.value || select.value === "all" || monthKey(order.updated_at || order.created_at) === select.value;
    });
    var header = isEn()
      ? ["order_id", "updated_at", "buyer_email", "products", "status", "subtotal", "shipping_fee", "platform_fee", "total"]
      : ["訂單編號", "更新時間", "買家信箱", "商品", "狀態", "小計", "運費", "平台手續費", "訂單總額"];
    var lines = [header.join(",")].concat(rows.map(function (order) {
      return [
        order.id,
        formatTime(order.updated_at || order.created_at),
        order.buyer_email || "",
        '"' + itemNames(order).replace(/"/g, '""') + '"',
        statusLabel(order.status),
        order.subtotal,
        order.shipping_fee,
        order.platform_fee,
        order.total
      ].join(",");
    }));
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "market-transactions.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  var productDialog = document.getElementById("market-product-dialog");
  if (productDialog) {
    productDialog.addEventListener("click", function (event) {
      if (event.target === productDialog) closeProductDetail();
    });
  }

  document.body.addEventListener("click", async function (event) {
    var removePhoto = event.target.closest("[data-remove-photo]");
    if (removePhoto && removePhoto.closest("#market-photo-list")) {
      event.preventDefault();
      var removed = draftPhotos.splice(Number(removePhoto.getAttribute("data-remove-photo")), 1)[0];
      if (removed && removed.file && removed.preview && removed.preview.indexOf("blob:") === 0) URL.revokeObjectURL(removed.preview);
      renderDraftPhotos();
      return;
    }
    var thumb = event.target.closest(".market-photo-thumb");
    if (thumb) {
      event.preventDefault();
      var wrap = thumb.closest(".market-media-wrap");
      var main = wrap && wrap.querySelector(".market-media");
      var nextUrl = thumb.getAttribute("data-photo");
      if (main && nextUrl) {
        if (main.tagName === "VIDEO") main.poster = nextUrl;
        else main.src = nextUrl;
      }
      if (wrap) {
        wrap.querySelectorAll(".market-photo-thumb").forEach(function (button) {
          button.classList.toggle("is-current", button === thumb);
        });
      }
      return;
    }
    if (event.target.closest("#market-product-close")) {
      closeProductDetail();
      return;
    }
    var productCard = event.target.closest("[data-product]");
    if (productCard && !event.target.closest("button, input, textarea, select, label, video, a")) {
      var product = productById(productCard.getAttribute("data-product"));
      if (product) openProductDetail(product);
      return;
    }
    if (event.target.closest("#market-login") || event.target.closest("[data-open-auth]")) {
      openMarketAuth("login");
      return;
    }
    var viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      var next = viewButton.getAttribute("data-view");
      if (next === "admin" && !isAdmin()) {
        showStatus("只有管理員可以查看全平台交易。", "Only an admin can monitor platform transactions.", "err");
        return;
      }
      if ((next === "seller" || next === "inventory" || next === "compose" || next === "changes") && (registeredSide() === "buyer" || !canSell())) {
        showStatus("買家不能管理商品、庫存或賣家訂單。", "Buyers cannot manage products, inventory, or seller orders.", "err");
        return;
      }
      if ((next === "member" || next === "cart" || next === "pay" || next === "account") && registeredSide() === "seller") {
        showStatus("這個帳號是賣家，不能下單。", "This account is a seller and cannot place orders.", "err");
        return;
      }
      if ((next === "member" || next === "cart" || next === "pay" || next === "account") && !canBuy()) {
        openMarketAuth();
        return;
      }
      if (next === "seller" || next === "inventory" || next === "compose" || next === "changes") {
        mode = "seller";
        localStorage.setItem(MODE_KEY, mode);
      }
      setView(next);
      if (next === "compose") openForm(null);
      renderChrome();
      return;
    }
    var detailButton = event.target.closest("[data-admin-detail]");
    if (detailButton) {
      adminDetailId = detailButton.getAttribute("data-admin-detail");
      renderAdmin();
      var detailPanel = document.querySelector(".order-detail");
      if (detailPanel) detailPanel.scrollIntoView({ block: "start" });
      return;
    }
    if (event.target.closest("[data-admin-detail-close]")) {
      adminDetailId = "";
      renderAdmin();
      return;
    }
    var memberDetail = event.target.closest("[data-member-detail]");
    if (memberDetail) {
      memberDetailId = memberDetail.getAttribute("data-member-detail");
      renderMember();
      var memberPanel = document.querySelector("#market-member .order-detail");
      if (memberPanel) memberPanel.scrollIntoView({ block: "start" });
      return;
    }
    if (event.target.closest("[data-member-detail-close]")) {
      memberDetailId = "";
      renderMember();
      return;
    }
    var overviewButton = event.target.closest("[data-order-overview]");
    if (overviewButton) {
      var nextOverview = overviewButton.getAttribute("data-order-overview");
      overviewOrderId = overviewOrderId === nextOverview ? "" : nextOverview;
      renderMember();
      var panel = document.querySelector(".market-order-overview");
      if (panel) panel.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.target.closest("[data-order-overview-close]")) {
      overviewOrderId = "";
      renderMember();
      return;
    }
    var modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      var nextMode = modeButton.getAttribute("data-mode") === "seller" ? "seller" : "buyer";
      if (nextMode === "seller" && (registeredSide() === "buyer" || !canSell())) {
        showStatus("這個帳號是買家，不能切換到賣家。", "This account is a buyer and cannot switch to seller.", "err");
        return;
      }
      if (nextMode === "buyer" && (registeredSide() === "seller" || !canBuy())) {
        showStatus("這個帳號是賣家，不能切換到買家。", "This account is a seller and cannot switch to buyer.", "err");
        return;
      }
      mode = nextMode;
      localStorage.setItem(MODE_KEY, mode);
      if (mode === "seller") setView("inventory");
      if (mode === "buyer") setView("listings");
      renderChrome();
      renderListings();
      return;
    }
    var cartButton = event.target.closest("[data-cart]");
    if (cartButton) {
      if (registeredSide() === "seller") {
        showStatus("這個帳號是賣家，不能下單。", "This account is a seller and cannot place orders.", "err");
        return;
      }
      if (!canBuy()) {
        openMarketAuth();
        return;
      }
      var productId = cartButton.getAttribute("data-cart");
      var product = productById(productId);
      var input = document.querySelector('[data-qty="' + productId + '"]');
      var quantity = Math.max(1, Number(input && input.value) || 1);
      if (!product || quantity > Number(product.quantity)) {
        showStatus("數量超過可售庫存。", "That quantity is more than the available stock.", "err");
        return;
      }
      var cart = readCart();
      cart[productId] = quantity;
      writeCart(cart);
      cartPicked[productId] = true;
      showStatus("已加入購物車。", "Added to cart.", "ok");
      return;
    }
    var cartEdit = event.target.closest("[data-cart-edit]");
    if (cartEdit) {
      cartEditId = cartEdit.getAttribute("data-cart-edit");
      renderCart();
      return;
    }
    var cartSave = event.target.closest("[data-cart-save]");
    if (cartSave) {
      var saveId = cartSave.getAttribute("data-cart-save");
      var saveInput = document.querySelector('[data-cart-qty="' + saveId + '"]');
      var saveProduct = productById(saveId);
      var saveQty = Math.max(1, Number(saveInput && saveInput.value) || 1);
      if (!saveProduct || saveQty > Number(saveProduct.quantity)) {
        showStatus("數量超過可售庫存。", "That quantity is more than the available stock.", "err");
        return;
      }
      var savedCart = readCart();
      savedCart[saveId] = saveQty;
      writeCart(savedCart);
      cartEditId = "";
      renderCart();
      return;
    }
    var pickBox = event.target.closest("[data-cart-pick]");
    if (pickBox) {
      cartPicked[pickBox.getAttribute("data-cart-pick")] = !!pickBox.checked;
      renderCart();
      return;
    }
    if (event.target.closest("[data-cart-select-all]")) {
      cartLines().forEach(function (line) { cartPicked[line.product.id] = true; });
      renderCart();
      return;
    }
    if (event.target.id === "market-to-pay" || event.target.closest("#market-to-pay")) {
      if (!cartLines().length) {
        showStatus("購物車是空的。", "Your cart is empty.", "err");
        return;
      }
      if (!selectedLines().length) {
        showStatus("請先勾選要下單的商品。", "Select the items you want to order.", "err");
        return;
      }
      setView("pay");
      return;
    }
    if (event.target.id === "market-pay-back" || event.target.closest("#market-pay-back")) {
      setView("cart");
      return;
    }
    if (event.target.id === "market-open-seller" || event.target.closest("#market-open-seller")) {
      if (registeredSide() === "buyer" || !canSell()) {
        showStatus("這個帳號是買家，不能切換到賣家。", "This account is a buyer and cannot switch to seller.", "err");
        return;
      }
      mode = "seller";
      localStorage.setItem(MODE_KEY, mode);
      setView("seller");
      renderChrome();
      renderListings();
      return;
    }
    var removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      var cartNow = readCart();
      var removedId = removeButton.getAttribute("data-remove");
      delete cartNow[removedId];
      delete cartPicked[removedId];
      writeCart(cartNow);
      renderCart();
      return;
    }
    if (event.target.id === "market-checkout" || event.target.closest("#market-checkout")) {
      await checkout();
      return;
    }
    var editButton = event.target.closest("[data-edit]");
    if (editButton) {
      if (!canSell()) return;
      var editItem = productById(editButton.getAttribute("data-edit"));
      if (!editItem || editItem.seller_id !== uid()) return;
      openStockDialog(editItem);
      return;
    }
    var deleteButton = event.target.closest("[data-delete-product]");
    if (deleteButton) {
      var deleteId = deleteButton.getAttribute("data-delete-product");
      var deleteProduct = productById(deleteId);
      if (!canSell() || !deleteProduct || deleteProduct.seller_id !== uid()) return;
      var deleteName = deleteProduct ? productTitle(deleteProduct) : "";
      if (!window.confirm(t("要刪除「" + deleteName + "」嗎？已完成的訂單仍會保留。", "Delete “" + deleteName + "”? Completed orders stay on record."))) return;
      var removed = await auth.getClient().from("market_products").delete().eq("id", deleteId).eq("seller_id", uid());
      if (removed.error) {
        showStatus("刪除失敗：" + removed.error.message, "Could not delete the item: " + removed.error.message, "err");
        return;
      }
      var cartNow = readCart();
      delete cartNow[deleteId];
      writeCart(cartNow);
      await logMarket({
        action: "DELETE",
        entity_type: "market_product",
        entity_id: deleteId,
        entity_label: deleteName,
        summary: "deleted"
      });
      showStatus("商品已刪除，瀏覽商品已同步。", "Item deleted. Browse is updated.", "ok");
      await refresh();
      return;
    }
    var soldButton = event.target.closest("[data-sold]");
    if (soldButton) {
      var soldId = soldButton.getAttribute("data-sold");
      var soldItem = productById(soldId);
      if (!canSell() || !soldItem || soldItem.seller_id !== uid()) return;
      await auth.getClient().from("market_products").update({ status: "sold" }).eq("id", soldId).eq("seller_id", uid());
      await logMarket({
        action: "UPDATE",
        entity_type: "market_product",
        entity_id: soldId,
        entity_label: soldItem ? productTitle(soldItem) : soldId,
        summary: "marked sold"
      });
      await refresh();
      return;
    }
    var hideButton = event.target.closest("[data-hide]");
    if (hideButton) {
      var hideId = hideButton.getAttribute("data-hide");
      var hideItem = productById(hideId);
      if (!canSell() || !hideItem || hideItem.seller_id !== uid()) return;
      await auth.getClient().from("market_products").update({ status: "hidden" }).eq("id", hideId).eq("seller_id", uid());
      await logMarket({
        action: "UPDATE",
        entity_type: "market_product",
        entity_id: hideId,
        entity_label: hideItem ? productTitle(hideItem) : hideId,
        summary: "hidden"
      });
      await refresh();
      return;
    }
    var stockButton = event.target.closest("[data-stock-save]");
    if (stockButton) {
      var stockId = stockButton.getAttribute("data-stock-save");
      var stockInput = document.querySelector('[data-stock="' + stockId + '"]');
      var stockItem = productById(stockId);
      if (!stockItem || stockItem.seller_id !== uid()) return;
      var stock = Number(stockInput && stockInput.value);
      if (stock < 0 || stockInput.value === "") return;
      var stockResult = await auth.getClient().from("market_products").update({ quantity: stock }).eq("id", stockId).eq("seller_id", uid());
      if (stockResult.error) {
        showStatus("庫存更新失敗：" + stockResult.error.message, "Could not update stock: " + stockResult.error.message, "err");
        return;
      }
      showStatus("數量已更新，瀏覽商品已同步。", "Quantity updated. Browse is updated.", "ok");
      await refresh();
      return;
    }
    var cancelOpen = event.target.closest("[data-cancel-open]");
    if (cancelOpen) {
      var cancelSelect = document.querySelector('[data-cancel-reason="' + cancelOpen.getAttribute("data-cancel-open") + '"]');
      if (cancelSelect) {
        cancelSelect.hidden = false;
        cancelSelect.focus();
        if (typeof cancelSelect.showPicker === "function") {
          try { cancelSelect.showPicker(); } catch (err) { return; }
        }
      }
      return;
    }
    var confirmCancel = event.target.closest("[data-confirm-cancel]");
    if (confirmCancel) {
      var confirmId = confirmCancel.getAttribute("data-confirm-cancel");
      if (!canSell() || !orders.some(function (order) { return order.id === confirmId && order.seller_id === uid(); })) {
        showStatus("只能處理自己的賣家訂單。", "You can only process your own seller orders.", "err");
        return;
      }
      var confirmed = await auth.getClient().rpc("confirm_market_cancel", { p_order: confirmId });
      if (confirmed.error) {
        showStatus("確認取消失敗：" + confirmed.error.message, "Could not confirm the cancellation: " + confirmed.error.message, "err");
        return;
      }
      showStatus("已確認取消，訂單已取消。", "Cancellation confirmed. The order is cancelled.", "ok");
      await logMarket({
        action: "UPDATE",
        entity_type: "market_order",
        entity_id: confirmId,
        entity_label: confirmId,
        summary: "cancellation confirmed"
      });
      await refresh();
      setView("seller");
      return;
    }
    var advance = event.target.closest("[data-advance]");
    if (advance) {
      var advanceId = advance.getAttribute("data-advance");
      if (!canSell() || !orders.some(function (order) { return order.id === advanceId && order.seller_id === uid(); })) {
        showStatus("只能處理自己的賣家訂單。", "You can only process your own seller orders.", "err");
        return;
      }
      if (advance.getAttribute("data-next") === "ready_to_ship") {
        openShipDialog(advance.getAttribute("data-advance"));
        return;
      }
      var advanced = await auth.getClient().rpc("advance_market_order", {
        p_order: advance.getAttribute("data-advance"),
        p_next: advance.getAttribute("data-next")
      });
      if (advanced.error) {
        showStatus("狀態更新失敗：" + advanced.error.message, "Could not update the order: " + advanced.error.message, "err");
        return;
      }
      showStatus("訂單狀態已更新。", "Order status updated.", "ok");
      await logMarket({
        action: "UPDATE",
        entity_type: "market_order",
        entity_id: advance.getAttribute("data-advance"),
        entity_label: advance.getAttribute("data-advance"),
        summary: statusLabel(advance.getAttribute("data-next"))
      });
      await refresh();
      setView("seller");
    }
  });

  document.addEventListener("change", async function (event) {
    var reasonSelect = event.target.closest("[data-cancel-reason]");
    if (!reasonSelect) return;
    var reason = reasonSelect.value;
    if (!reason) return;
    var orderId = reasonSelect.getAttribute("data-cancel-reason");
    reasonSelect.disabled = true;
    var cancelled = await auth.getClient().rpc("cancel_market_order", {
      p_order: orderId,
      p_reason: reason
    });
    if (cancelled.error) {
      reasonSelect.disabled = false;
      reasonSelect.value = "";
      showStatus("取消失敗：" + cancelled.error.message, "Could not cancel the order: " + cancelled.error.message, "err");
      return;
    }
    await logMarket({
      action: "UPDATE",
      entity_type: "market_order",
      entity_id: orderId,
      entity_label: orderId,
      summary: "cancel requested: " + reason
    });
    if (reason === "wrong_address") {
      showStatus("已送出取消申請，等待賣家確認。確認後請重新下單並填寫正確地址。", "Cancellation requested. After the seller confirms, place the order again with the correct address.", "ok");
    } else {
      showStatus("已送出取消申請，等待賣家確認。", "Cancellation requested. Waiting for the seller to confirm.", "ok");
    }
    await refresh();
    setView("member");
  });

  async function checkout() {
    if (registeredSide() === "seller" || !canBuy()) {
      if (registeredSide() === "seller") {
        showStatus("這個帳號是賣家，不能下單。", "This account is a seller and cannot place orders.", "err");
      } else {
        openMarketAuth();
      }
      return;
    }
    var chosen = selectedLines();
    var groups = {};
    chosen.forEach(function (line) {
      var seller = line.product.seller_id;
      if (!groups[seller]) groups[seller] = [];
      groups[seller].push({ product_id: line.product.id, quantity: line.quantity });
    });
    var sellers = Object.keys(groups);
    if (!sellers.length) {
      showStatus("請先勾選要下單的商品。", "Select the items you want to order.", "err");
      return;
    }
    var shipping = "pickup";
    document.querySelectorAll('input[name="market-ship"]').forEach(function (input) {
      if (input.checked) shipping = input.value;
    });
    var recipient = "";
    var phone = "";
    var address = "";
    if (shipping === "delivery") {
      recipient = ((document.getElementById("market-recipient") || {}).value || "").trim();
      phone = ((document.getElementById("market-phone") || {}).value || "").trim();
      address = ((document.getElementById("market-address") || {}).value || "").trim();
      if (!recipient || !phone || !address) {
        showStatus("請填寫收件人、連絡電話和收件地址。", "Enter the recipient, phone number, and address.", "err");
        return;
      }
    }
    var sb = auth.getClient();
    for (var i = 0; i < sellers.length; i += 1) {
      var placed = await sb.rpc("place_market_order", {
        p_items: groups[sellers[i]],
        p_shipping: shipping,
        p_recipient: recipient,
        p_phone: phone,
        p_address: address
      });
      if (placed.error) {
        showStatus("下單失敗：" + placed.error.message, "Checkout failed: " + placed.error.message, "err");
        return;
      }
    }
    var cart = readCart();
    chosen.forEach(function (line) {
      delete cart[line.product.id];
      delete cartPicked[line.product.id];
    });
    writeCart(cart);
    showStatus("付款已送出，等待賣家確認收款。", "Payment submitted. Waiting for the seller to confirm it.", "ok");
    await refresh();
    setView("member");
  }

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        paintStatus();
        if (ready) renderAll();
      }, 0);
    });
  }

  var marketAuthMode = "login";
  var entryChoice = "buyer";
  var applyChoice = "buyer";

  function setEntryChoice(next) {
    entryChoice = next === "seller" ? "seller" : "buyer";
    document.querySelectorAll("[data-entry]").forEach(function (button) {
      var selected = button.getAttribute("data-entry") === entryChoice;
      button.classList.toggle("is-current", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function setApplyChoice(next) {
    applyChoice = next === "seller" ? "seller" : "buyer";
    document.querySelectorAll("[data-apply]").forEach(function (button) {
      var selected = button.getAttribute("data-apply") === applyChoice;
      button.classList.toggle("is-current", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function marketAuthStatus(message, kind) {
    var statusEl = document.getElementById("market-auth-status");
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message || "";
  }

  function setMarketAuthMode(nextMode) {
    marketAuthMode = nextMode === "register" || nextMode === "forgot" ? nextMode : "login";
    document.getElementById("market-auth-login").hidden = marketAuthMode !== "login";
    document.getElementById("market-auth-register").hidden = marketAuthMode !== "register";
    document.getElementById("market-auth-forgot").hidden = marketAuthMode !== "forgot";
    ["login", "register", "forgot"].forEach(function (name) {
      var button = document.getElementById("market-auth-tab-" + name);
      if (!button) return;
      var active = marketAuthMode === name;
      button.className = "btn " + (active ? "btn-gold" : "btn-outline");
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function openMarketAuth(nextMode) {
    setMarketAuthMode(nextMode || "login");
    marketAuthStatus("");
    var dialog = document.getElementById("market-auth");
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }

  function finishMarketAuth(profile) {
    var dialog = document.getElementById("market-auth");
    if (dialog && dialog.open) dialog.close();
    var side = profile && (profile.apply_as === "seller" || profile.apply_as === "buyer") ? profile.apply_as : "";
    var wantSeller = side ? side === "seller" : entryChoice === "seller";
    if (wantSeller && canSell()) {
      setView("inventory");
      renderChrome();
      showStatus("已以賣家身分進入。", "Signed in as a seller.", "ok");
      return;
    }
    if (!wantSeller && canBuy()) {
      setView("listings");
      renderChrome();
      showStatus("已以買家身分進入。", "Signed in as a buyer.", "ok");
      return;
    }
    if (!side && canSell()) {
      setView("inventory");
      renderChrome();
      showStatus("這個帳號是賣家，已改以賣家身分進入。", "This account is a seller, so you are signed in as a seller.", "ok");
      return;
    }
    if (!side && canBuy()) {
      setView("listings");
      renderChrome();
      showStatus("這個帳號是買家，已改以買家身分進入。", "This account is a buyer, so you are signed in as a buyer.", "ok");
      return;
    }
    var waiting = side === "seller"
      ? ["帳號正在等待超級管理員審核。通過後才能管理自己的商品和處理自己的訂單。", "This account is waiting for a super admin. After approval you can manage your own products and orders."]
      : side === "buyer"
        ? ["帳號正在等待超級管理員審核。通過後才能下單和查看自己的訂單。", "This account is waiting for a super admin. After approval you can place orders and view your own orders."]
        : ["帳號正在等待超級管理員審核，通過後才能下單、上架和切換買賣家。", "This account is waiting for a super admin. After approval you can order, list items, and switch buyer or seller."];
    showStatus(
      profile && profile.role === "rejected" ? "此帳號無法進入書籍&市集。" : waiting[0],
      profile && profile.role === "rejected" ? "This account cannot enter Books & Marketplace." : waiting[1],
      "err"
    );
  }

  async function reloadMarketSession() {
    var session = await auth.getSession();
    var profile = session ? await auth.getProfile(true) : null;
    me = session ? { session: session, profile: profile } : null;
    applySideMode();
    await refresh();
    return profile;
  }

  document.querySelectorAll("[data-entry]").forEach(function (button) {
    button.addEventListener("click", function () {
      setEntryChoice(button.getAttribute("data-entry"));
    });
  });

  document.querySelectorAll("[data-apply]").forEach(function (button) {
    button.addEventListener("click", function () {
      setApplyChoice(button.getAttribute("data-apply"));
    });
  });

  document.querySelectorAll("[data-market-password]").forEach(function (button) {
    button.addEventListener("click", function () {
      var input = document.getElementById(button.getAttribute("data-market-password"));
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  document.getElementById("market-auth-tab-login").addEventListener("click", async function () {
    if (marketAuthMode !== "login") {
      marketAuthStatus("");
      setMarketAuthMode("login");
      return;
    }
    var form = document.getElementById("market-auth-login-form");
    if (!form.reportValidity()) return;
    try {
      await auth.signIn(
        document.getElementById("market-login-email").value,
        document.getElementById("market-login-password").value
      );
      var signedIn = await auth.getProfile(true);
      var picked = entryChoice === "seller" ? "seller" : "buyer";
      if (signedIn && (signedIn.apply_as === "buyer" || signedIn.apply_as === "seller") && signedIn.apply_as !== picked) {
        try { await auth.signOut(); } catch (ignore) {}
        me = null;
        marketAuthStatus(t("無此帳號存在", "This account does not exist."), "err");
        return;
      }
      finishMarketAuth(await reloadMarketSession());
    } catch (err) {
      var mapped = auth.mapAuthError ? auth.mapAuthError(err) : null;
      marketAuthStatus(mapped ? t(mapped.zh, mapped.en) : t("登入失敗。", "Sign-in failed."), "err");
    }
  });

  document.getElementById("market-auth-tab-register").addEventListener("click", function () {
    if (marketAuthMode !== "register") {
      marketAuthStatus("");
      setMarketAuthMode("register");
    }
  });

  ["market-reg-name", "market-reg-email", "market-reg-password", "market-reg-password2", "market-forgot-email"].forEach(function (id) {
    var field = document.getElementById(id);
    if (!field) return;
    field.addEventListener("input", function () {
      var registerReady = document.getElementById("market-reg-name").value.trim()
        && document.getElementById("market-reg-email").checkValidity()
        && document.getElementById("market-reg-password").value.length >= 6
        && document.getElementById("market-reg-password2").value.length >= 6;
      document.getElementById("market-reg-submit").hidden = !registerReady;
      var forgot = document.getElementById("market-forgot-email");
      document.getElementById("market-forgot-submit").hidden = !(forgot.value.trim() && forgot.checkValidity());
    });
  });

  document.getElementById("market-auth-register-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var pw = document.getElementById("market-reg-password").value;
    var pw2 = document.getElementById("market-reg-password2").value;
    if (pw !== pw2) {
      marketAuthStatus(t("兩次輸入的密碼不一致。", "Passwords do not match."), "err");
      return;
    }
    try {
      var data = await auth.signUp(
        document.getElementById("market-reg-email").value,
        pw,
        document.getElementById("market-reg-name").value,
        "market",
        applyChoice
      );
      var identities = (data.user && data.user.identities) || [];
      if (data.user && identities.length === 0) {
        marketAuthStatus(t("此信箱可能已註冊。請直接登入，或使用忘記密碼。", "This email may already be registered. Sign in, or use Forgot password."), "err");
        setMarketAuthMode("login");
        return;
      }
      if (data.session) {
        finishMarketAuth(await reloadMarketSession());
        return;
      }
      setMarketAuthMode("login");
      document.getElementById("market-login-email").value = document.getElementById("market-reg-email").value;
      var appliedSeller = applyChoice === "seller";
      marketAuthStatus(t(
        appliedSeller
          ? "註冊成功！已送出賣家申請。請到信箱點擊確認連結，並等超級管理員核准。"
          : "註冊成功！已送出買家申請。請到信箱點擊確認連結，並等超級管理員核准。",
        appliedSeller
          ? "Registered as a seller application. Open the confirmation link in your email, then wait for a super admin."
          : "Registered as a buyer application. Open the confirmation link in your email, then wait for a super admin."
      ), "ok");
    } catch (err) {
      var mappedReg = auth.mapAuthError ? auth.mapAuthError(err) : null;
      marketAuthStatus(mappedReg ? t(mappedReg.zh, mappedReg.en) : t("註冊失敗。", "Registration failed."), "err");
    }
  });

  document.getElementById("market-auth-tab-forgot").addEventListener("click", function () {
    if (marketAuthMode !== "forgot") {
      marketAuthStatus("");
      setMarketAuthMode("forgot");
    }
  });

  document.getElementById("market-auth-forgot-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    try {
      await auth.resetPassword(
        document.getElementById("market-forgot-email").value,
        location.origin + location.pathname.replace(/[^/]+$/, "") + "login.html?mode=reset&next=books.html"
      );
      marketAuthStatus(t("若此信箱已註冊，重設密碼郵件已寄出。", "If this email is registered, a reset link has been sent."), "ok");
    } catch (err) {
      var mappedForgot = auth.mapAuthError ? auth.mapAuthError(err) : null;
      marketAuthStatus(mappedForgot ? t(mappedForgot.zh, mappedForgot.en) : t("寄送失敗。", "Could not send reset email."), "err");
    }
  });

  document.getElementById("market-auth-login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    document.getElementById("market-auth-tab-login").click();
  });

  document.getElementById("market-auth-back").addEventListener("click", function () {
    var dialog = document.getElementById("market-auth");
    if (dialog && dialog.open) dialog.close();
    marketAuthStatus("");
    setView("listings");
  });

  (async function init() {
    mode = "buyer";
    localStorage.setItem(MODE_KEY, mode);
    view = "listings";
    document.getElementById("market-form").hidden = true;
    try {
      var session = await auth.getSession();
      if (session) {
        var profile = await auth.getProfile(true);
        me = { session: session, profile: profile };
      }
      applySideMode();
      await refresh();
      if (me && me.profile && !canBuy() && !canSell()) {
        var side = registeredSide();
        var waiting = side === "seller"
          ? ["帳號正在等待超級管理員審核。通過後才能管理自己的商品和處理自己的訂單。", "This account is waiting for a super admin. After approval you can manage your own products and orders."]
          : side === "buyer"
            ? ["帳號正在等待超級管理員審核。通過後才能下單和查看自己的訂單。", "This account is waiting for a super admin. After approval you can place orders and view your own orders."]
            : ["帳號正在等待超級管理員審核，通過後才能下單、上架和切換買賣家。", "This account is waiting for a super admin. After approval you can order, list items, and switch buyer or seller."];
        showStatus(
          me.profile.role === "rejected" ? "此帳號無法進入書籍&市集。" : waiting[0],
          me.profile.role === "rejected" ? "This account cannot enter Books & Marketplace." : waiting[1],
          "err"
        );
      }
      if (location.hash === "#cart") setView("cart");
      else setView(view);
    } catch (err) {
      var message = String((err && err.message) || err || "");
      showStatus(
        message.indexOf("market_") !== -1 ? "市集資料表尚未就緒。" : "載入失敗：" + message,
        message.indexOf("market_") !== -1 ? "The marketplace tables are not ready yet." : "Load failed: " + message,
        "err"
      );
    }
  })();
})();
