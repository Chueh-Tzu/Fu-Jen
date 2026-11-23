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
    if (stayMs) {
      statusTimer = setTimeout(function () {
        statusTimer = null;
        statusNote = null;
        paintStatus();
      }, stayMs);
    }
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
  function canTrade() {
    return !!(me && me.profile && me.profile.role !== "rejected");
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
    view = next;
    ["listings", "inventory", "cart", "pay", "member", "seller", "admin"].forEach(function (name) {
      var panel = document.getElementById("market-view-" + name);
      if (panel) panel.hidden = name !== next;
    });
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.classList.toggle("is-current", button.getAttribute("data-view") === next);
    });
    if (next === "listings") document.getElementById("market-form").hidden = true;
    if (next === "inventory") renderInventory();
    if (next === "cart") renderCart();
    if (next === "pay") renderPay();
    if (next === "member") renderMember();
    if (next === "seller") renderSeller();
    if (next === "admin") renderAdmin();
  }

  function selling() {
    return canTrade() && mode === "seller";
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
    var signedIn = canTrade();
    var sellerView = selling();
    document.getElementById("market-role").hidden = !signedIn;
    document.getElementById("market-listings-btn").hidden = false;
    document.getElementById("market-cart-btn").hidden = !signedIn || sellerView;
    document.getElementById("market-member-btn").hidden = !signedIn || sellerView;
    document.getElementById("market-add-btn").hidden = !sellerView;
    document.getElementById("market-inventory-btn").hidden = !sellerView;
    document.getElementById("market-seller-btn").hidden = !sellerView;
    document.getElementById("market-admin-btn").hidden = !isAdmin();
    document.getElementById("market-users-link").hidden = !isSuper();
    document.getElementById("market-login").hidden = signedIn;
    document.getElementById("market-signout").hidden = !signedIn;
    document.getElementById("market-role").hidden = true;
    document.getElementById("market-become-seller").hidden = sellerView;
    document.getElementById("market-buyer-mode").hidden = !sellerView;
    document.getElementById("market-seller-label").hidden = !sellerView;
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
    var pending = signedIn ? pendingSellerOrders() : 0;
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
    if (!signedIn) {
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

  function cardMedia(item) {
    var title = escapeHtml(productTitle(item));
    if (item.video_url) {
      return '<div class="market-media-wrap">' +
        '<video class="market-media" controls muted playsinline preload="none"' +
        (item.image_url ? ' poster="' + escapeHtml(item.image_url) + '"' : "") +
        ' aria-label="' + escapeHtml(t("產品影片：", "Product video: ")) + title + '">' +
        '<source src="' + escapeHtml(item.video_url) + '" type="video/mp4"></video>' +
        '<span class="market-video-tag">' + escapeHtml(t("產品影片", "Product video")) + "</span></div>";
    }
    if (item.image_url) {
      return '<img class="market-media" src="' + escapeHtml(item.image_url) + '" alt="' + title + '" loading="lazy">';
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
      } else if (canTrade()) {
        actions =
          '<label class="market-qty">' + t("數量", "Qty") +
          ' <input data-qty="' + item.id + '" type="number" min="1" max="' + stock + '" value="' + qty + '"></label>' +
          '<button type="button" class="btn btn-gold" data-cart="' + item.id + '">' + t("加入購物車", "Add to cart") + "</button>";
      } else {
        actions = '<a class="btn btn-gold" href="login.html?next=books.html">' + t("登入後下單", "Sign in to order") + "</a>";
      }
      return (
        '<article class="swap-card">' +
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
        "<tr><td><strong>" + escapeHtml(shortCode(item.id)) + "</strong><br>" + escapeHtml(productTitle(item)) +
        "<br><span class=\"swap-muted\">" + escapeHtml(categoryLabel(item.category)) + "</span></td>" +
        "<td>" + escapeHtml(money(item.price)) + "</td>" +
        "<td>" + inventory + "</td><td>" + purchased + "</td><td>" + available + " " + stockNote + "</td>" +
        "<td><span class=\"swap-pill\">" + escapeHtml(statusLabel(item.status)) + "</span></td>" +
        '<td class="swap-actions"><button type="button" class="btn btn-outline" data-edit="' + item.id + '">' + t("編輯", "Edit") + "</button> " +
        '<button type="button" class="btn btn-outline" data-hide="' + item.id + '">' + t("隱藏", "Hide") + "</button> " +
        '<button type="button" class="btn btn-outline" data-delete-product="' + item.id + '">' + t("刪除", "Delete") + "</button></td></tr>"
      );
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
        if (box) box.hidden = !delivery;
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
      "</div>" +
      '<button type="button" class="btn btn-outline" data-member-detail="' + order.id + '">' +
      t("訂單詳情", "Order details") + "</button></div>" +
      trackLog(order) +
      "</article>";
  }

  function renderMember() {
    var host = document.getElementById("market-member");
    if (!canTrade()) {
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
      return '<button type="button" class="btn btn-gold" data-confirm-cancel="' + order.id + '">' +
        t("確認取消", "Confirm cancellation") + "</button>";
    }
    if (order.status === "awaiting_payment") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="payment_confirmed">' +
        t("確認付款", "Confirm payment") + "</button>";
    }
    if (order.status === "payment_confirmed") {
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

  function renderSeller() {
    var host = document.getElementById("market-seller");
    var mine = orders.filter(function (order) { return order.seller_id === uid(); });
    var open = mine.filter(function (order) {
      return order.status !== "completed" && order.status !== "cancelled";
    });
    host.innerHTML =
      '<p class="swap-count">' + escapeHtml(t(open.length + " 筆待處理", open.length + " orders to process")) + "</p>" +
      (mine.length
        ? mine.map(function (order) { return swapOrder(order, sellerAction(order), "seller"); }).join("")
        : '<p class="market-empty">' + escapeHtml(t("目前沒有訂單。", "There are no orders at the moment.")) + "</p>");
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
    if (view === "cart") renderCart();
    if (view === "pay") renderPay();
    if (view === "member") renderMember();
    if (view === "seller") renderSeller();
    if (view === "admin") renderAdmin();
  }

  async function refresh() {
    var sb = auth.getClient();
    var productResult = await sb.from("market_products").select("*").order("created_at", { ascending: false });
    if (productResult.error) throw productResult.error;
    products = productResult.data || [];
    orders = [];
    if (me) {
      var orderResult = await sb.from("market_orders").select("*, market_order_items(*)").order("created_at", { ascending: false });
      if (orderResult.error) throw orderResult.error;
      orders = orderResult.data || [];
    }
    var feeResult = await sb.from("market_settings").select("platform_fee").eq("id", 1).maybeSingle();
    if (!feeResult.error && feeResult.data) fee = Number(feeResult.data.platform_fee) || 0;
    ready = true;
    renderAll();
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
    document.getElementById("market-image").value = product && product.image_url ? product.image_url : "";
    document.getElementById("market-video").value = product && product.video_url ? product.video_url : "";
    document.getElementById("market-listing-status").value = product ? product.status : "listed";
    document.getElementById("market-form-title").innerHTML = product
      ? '<span class="zh">編輯商品</span><span class="en">Edit item</span>'
      : '<span class="zh">新增商品</span><span class="en">Add new item</span>';
    document.getElementById("market-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!canTrade()) {
      location.href = "login.html?next=books.html";
      return;
    }
    var id = document.getElementById("market-product-id").value;
    var nameZh = document.getElementById("market-name-zh").value.trim();
    var nameEn = document.getElementById("market-name-en").value.trim();
    var record = {
      name: nameEn || nameZh,
      name_zh: nameZh,
      name_en: nameEn,
      category: document.getElementById("market-category").value,
      description: document.getElementById("market-description-en").value.trim(),
      description_zh: document.getElementById("market-description-zh").value.trim(),
      description_en: document.getElementById("market-description-en").value.trim(),
      price: Number(document.getElementById("market-price").value),
      quantity: Number(document.getElementById("market-quantity").value),
      image_url: document.getElementById("market-image").value.trim() || null,
      video_url: document.getElementById("market-video").value.trim() || null,
      status: document.getElementById("market-listing-status").value
    };
    if (!nameZh || !nameEn || record.price < 0 || record.quantity < 0) {
      showStatus("請填寫中文名稱、英文名稱、價格與數量。", "Enter the Chinese name, English name, price, and quantity.", "err");
      return;
    }
    var sb = auth.getClient();
    var result = id
      ? await sb.from("market_products").update(record).eq("id", id).select().maybeSingle()
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
    document.getElementById("market-form").hidden = true;
    showStatus("商品已儲存。", "Item saved.", "ok");
    await refresh();
  }

  async function addSamples() {
    if (!canTrade()) return;
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

  document.getElementById("market-form").addEventListener("submit", saveProduct);
  document.getElementById("market-form-cancel").addEventListener("click", function () {
    document.getElementById("market-form").hidden = true;
  });
  document.getElementById("market-seed").addEventListener("click", addSamples);
  document.getElementById("market-add-btn").addEventListener("click", function () {
    mode = "seller";
    localStorage.setItem(MODE_KEY, mode);
    setView("inventory");
    openForm(null);
    renderChrome();
  });
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
    localStorage.setItem("immba-locale", next);
    location.href = "books.html";
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

  document.body.addEventListener("click", async function (event) {
    var viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      var next = viewButton.getAttribute("data-view");
      if ((next === "member" || next === "seller" || next === "inventory") && !canTrade()) {
        location.href = "login.html?next=books.html";
        return;
      }
      if (next === "seller" || next === "inventory") {
        mode = "seller";
        localStorage.setItem(MODE_KEY, mode);
      }
      setView(next);
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
      if (!canTrade()) {
        location.href = "login.html?next=books.html";
        return;
      }
      mode = modeButton.getAttribute("data-mode") === "seller" ? "seller" : "buyer";
      localStorage.setItem(MODE_KEY, mode);
      if (mode === "seller") setView("inventory");
      if (mode === "buyer") setView("listings");
      renderChrome();
      renderListings();
      return;
    }
    var cartButton = event.target.closest("[data-cart]");
    if (cartButton) {
      if (!canTrade()) {
        location.href = "login.html?next=books.html";
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
      showStatus("已加入購物車。", "Added to cart.", "ok", 10000);
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
      openForm(productById(editButton.getAttribute("data-edit")));
      return;
    }
    var deleteButton = event.target.closest("[data-delete-product]");
    if (deleteButton) {
      var deleteId = deleteButton.getAttribute("data-delete-product");
      var deleteProduct = productById(deleteId);
      var deleteName = deleteProduct ? productTitle(deleteProduct) : "";
      if (!window.confirm(t("要刪除「" + deleteName + "」嗎？已完成的訂單仍會保留。", "Delete “" + deleteName + "”? Completed orders stay on record."))) return;
      var removed = await auth.getClient().from("market_products").delete().eq("id", deleteId);
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
      showStatus("商品已刪除。", "Item deleted.", "ok");
      await refresh();
      return;
    }
    var soldButton = event.target.closest("[data-sold]");
    if (soldButton) {
      var soldId = soldButton.getAttribute("data-sold");
      var soldItem = productById(soldId);
      await auth.getClient().from("market_products").update({ status: "sold" }).eq("id", soldId);
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
      await auth.getClient().from("market_products").update({ status: "hidden" }).eq("id", hideId);
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
      var stock = Number(stockInput && stockInput.value);
      if (stock < 0) return;
      var stockResult = await auth.getClient().from("market_products").update({ quantity: stock }).eq("id", stockId);
      if (stockResult.error) {
        showStatus("庫存更新失敗：" + stockResult.error.message, "Could not update stock: " + stockResult.error.message, "err");
        return;
      }
      showStatus("庫存已更新。", "Stock updated.", "ok");
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
    if (!canTrade()) {
      location.href = "login.html?next=books.html";
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
      await refresh();
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
