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
  var overviewOrderId = "";
  var ready = false;
  var statusNote = null;

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
  function showStatus(zh, en, kind) {
    statusNote = { zh: zh, en: en || zh, kind: kind || "ok" };
    paintStatus();
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
    if (mode === "seller" && canTrade()) {
      return products.filter(function (item) { return item.seller_id === uid(); });
    }
    return products.filter(function (item) {
      return item.status === "listed";
    });
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
      return order.seller_id === uid() && order.status === "awaiting_payment";
    }).length;
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
    document.getElementById("market-listings-btn").innerHTML = sellerView
      ? '<span class="zh">我的商品</span><span class="en">My listings</span>'
      : '<span class="zh">瀏覽商品</span><span class="en">Browse products</span>';
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
    var openOrders = signedIn ? orders.filter(function (order) {
      return order.seller_id === uid() && order.status !== "completed";
    }).length : 0;
    if (!signedIn || sellerView || !openOrders) {
      notice.hidden = true;
      notice.innerHTML = "";
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
    var sellerView = selling();
    grid.classList.toggle("is-browse", !sellerView);
    var filter = document.getElementById("market-category-filter");
    document.getElementById("market-browse-filter").hidden = sellerView;
    title.innerHTML = sellerView
      ? '<span class="zh">我的商品</span><span class="en">My listings</span>'
      : '<span class="zh">瀏覽商品</span><span class="en">Browse products</span>';
    var rows = visibleProducts().filter(function (item) {
      return sellerView || !filter.value || filter.value === "all" || item.category === filter.value;
    });
    if (!rows.length) {
      grid.innerHTML = '<p class="market-empty">' + escapeHtml(t("目前沒有可顯示的商品。", "No products to show.")) + "</p>";
      return;
    }
    var cart = readCart();
    grid.innerHTML = rows.map(function (item) {
      var stock = Number(item.quantity) || 0;
      var low = item.status === "listed" && stock === 1;
      var qty = Math.max(1, Math.min(Number(cart[item.id] || 1), Math.max(stock, 1)));
      var actions = "";
      if (sellerView && item.seller_id === uid()) {
        actions =
          '<button type="button" class="btn btn-outline" data-edit="' + item.id + '">' + t("編輯商品", "Edit item") + "</button>" +
          '<button type="button" class="btn btn-outline" data-sold="' + item.id + '">' + t("標記售出", "Mark as sold") + "</button>" +
          '<button type="button" class="btn btn-outline" data-hide="' + item.id + '">' + t("隱藏", "Hide") + "</button>" +
          '<button type="button" class="btn btn-outline" data-delete-product="' + item.id + '">' + t("刪除", "Delete") + "</button>";
      } else if (!sellerView && stock <= 0) {
        actions = '<p class="market-note">' + escapeHtml(t("已售完", "Sold out")) + "</p>";
      } else if (!sellerView && canTrade()) {
        actions =
          '<label class="market-qty">' + t("數量", "Qty") +
          ' <input data-qty="' + item.id + '" type="number" min="1" max="' + stock + '" value="' + qty + '"></label>' +
          '<button type="button" class="btn btn-gold" data-cart="' + item.id + '">' + t("加入購物車", "Add to cart") + "</button>";
      } else if (!sellerView) {
        actions = '<p class="market-note">' + escapeHtml(t("登入後才能加入購物車。", "Sign in to add this item to the cart.")) + "</p>";
      }
      return (
        '<article class="market-card">' +
        cardMedia(item) +
        '<p class="kicker">' + escapeHtml(categoryLabel(item.category)) + "</p>" +
        "<h3>" + escapeHtml(productTitle(item)) + "</h3>" +
        (low ? '<p class="market-low">' + escapeHtml(t("庫存不足，剩下 " + item.quantity + " 件", "Low stock (" + item.quantity + " left)")) + "</p>" : "") +
        "<p>" + escapeHtml(productBlurb(item)) + "</p>" +
        '<p class="market-price">' + escapeHtml(money(item.price)) + "</p>" +
        "<p>" + escapeHtml(t("可售數量：", "Available quantity: ") + item.quantity) + " · " + escapeHtml(statusLabel(item.status)) + "</p>" +
        "<p>" + escapeHtml(t("賣家：", "Seller: ") + (item.seller_name || t("已註冊會員", "Registered member"))) + "</p>" +
        '<p class="market-note">' + escapeHtml(t("請透過平台或雙方約定的方式聯絡賣家。", "Please contact the seller through the platform or via an agreed communication channel.")) + "</p>" +
        '<div class="market-card-actions">' + actions + "</div></article>"
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
      "可售庫存共 " + total + " 件",
      "Total available stock: " + total
    );
    if (!mine.length) {
      body.innerHTML = '<tr><td colspan="4">' + escapeHtml(t("尚未上架商品。", "No listings yet.")) + "</td></tr>";
      return;
    }
    body.innerHTML = mine.map(function (item) {
      var alert = item.status === "listed" && Number(item.quantity) <= 1
        ? t("庫存不足，剩下 " + item.quantity + " 件", "Low stock alert: only " + item.quantity + " left")
        : "—";
      return (
        "<tr><td>" + escapeHtml(productTitle(item)) + "</td><td>" + escapeHtml(statusLabel(item.status)) + "</td><td>" +
        escapeHtml(alert) + '</td><td><input data-stock="' + item.id + '" type="number" min="0" step="1" value="' +
        Number(item.quantity) + '"> <button type="button" class="btn btn-outline" data-stock-save="' + item.id + '">' +
        t("更新庫存", "Update stock") + "</button> <button type=\"button\" class=\"btn btn-outline\" data-delete-product=\"" +
        item.id + '">' + t("刪除", "Delete") + "</button></td></tr>"
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

  function renderCart() {
    var host = document.getElementById("market-cart");
    var lines = cartLines();
    if (!lines.length) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("購物車是空的。", "Your cart is empty.")) + "</p>";
      return;
    }
    var subtotal = lines.reduce(function (sum, line) {
      return sum + line.product.price * line.quantity;
    }, 0);
    host.innerHTML =
      '<div class="admin-news-table-wrap"><table class="admin-news-table market-cart-table"><thead><tr>' +
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
        return "<tr><td>" + cartThumb(line.product) + "</td><td>" + escapeHtml(productTitle(line.product)) +
          "</td><td>" + quantityCell + "</td><td>" + escapeHtml(money(line.product.price * line.quantity)) +
          "</td><td>" + editCell + "</td><td>" +
          '<button type="button" class="btn btn-outline" data-remove="' + line.product.id + '">' +
          t("刪除", "Delete") + "</button></td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      '<p class="market-cart-total">' + escapeHtml(t("總金額 ", "Total ") + money(subtotal)) + "</p>" +
      '<button type="button" class="btn btn-gold" id="market-to-pay">' + t("確認下單", "Confirm order") + "</button>";
  }

  function renderPay() {
    var host = document.getElementById("market-pay");
    var lines = cartLines();
    if (!lines.length) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("購物車是空的，請先選商品。", "Your cart is empty. Choose a product first.")) + "</p>";
      return;
    }
    var subtotal = lines.reduce(function (sum, line) {
      return sum + line.product.price * line.quantity;
    }, 0);
    host.innerHTML =
      '<p class="market-note">' + escapeHtml(t(
        "這是課程示範的付款畫面，不會真的扣款。送出後，賣家會在賣家模式確認收款。",
        "This is a course-demo payment screen. No real charge is made. After you submit, the seller confirms the payment in seller mode."
      )) + "</p>" +
      "<ul class=\"market-pay-lines\">" +
      lines.map(function (line) {
        return "<li>" + escapeHtml(productTitle(line.product) + " × " + line.quantity + " · " + money(line.product.price * line.quantity)) + "</li>";
      }).join("") +
      "</ul>" +
      '<fieldset class="market-ship"><legend>' + t("運送方式", "Shipping method") + "</legend>" +
      '<label><input type="radio" name="market-ship" value="pickup" checked> ' + escapeHtml(shippingLabel("pickup")) + "</label>" +
      '<label><input type="radio" name="market-ship" value="delivery"> ' + escapeHtml(shippingLabel("delivery")) + "</label></fieldset>" +
      '<p id="market-pay-total" class="market-cart-total">' + escapeHtml(t("應付金額 ", "Amount due ") + money(subtotal)) + "</p>" +
      '<div class="market-form-actions">' +
      '<button type="button" class="btn btn-outline" id="market-pay-back">' + t("返回購物車", "Back to cart") + "</button>" +
      '<button type="button" class="btn btn-gold" id="market-checkout">' + t("確認付款", "Confirm payment") + "</button></div>";
    host.querySelectorAll('input[name="market-ship"]').forEach(function (input) {
      input.addEventListener("change", function () {
        var ship = input.value === "delivery" ? 80 : 0;
        document.getElementById("market-pay-total").textContent =
          t("應付金額 ", "Amount due ") + money(subtotal + ship);
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
        t("（不計入買家應付金額），應付 ", " (not added to the amount the buyer pays), amount due ") + money(order.total)
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
  function renderMember() {
    var host = document.getElementById("market-member");
    if (!canTrade()) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("請先登入才能查看訂單。", "Sign in to view your orders.")) + "</p>";
      return;
    }
    var mine = orders.filter(function (order) { return order.buyer_id === uid(); });
    if (!mine.length) {
      host.innerHTML = '<p class="market-empty">' + escapeHtml(t("還沒有訂單。", "No orders yet.")) + "</p>";
      return;
    }
    if (!mine.some(function (order) { return order.id === overviewOrderId; })) overviewOrderId = "";
    var open = mine.filter(function (order) { return order.id === overviewOrderId; })[0];
    host.innerHTML =
      '<div class="admin-news-table-wrap"><table class="admin-news-table market-orders-table"><thead><tr>' +
      "<th>" + t("訂單編號", "Order no.") + "</th>" +
      "<th>" + t("商品圖片", "Image") + "</th>" +
      "<th>" + t("商品名稱", "Product") + "</th>" +
      "<th>" + t("數量", "Qty") + "</th>" +
      "<th>" + t("金額", "Amount") + "</th>" +
      "<th>" + t("狀態", "Status") + "</th>" +
      "<th>" + t("商品總覽", "Items") + "</th>" +
      "</tr></thead><tbody>" +
      mine.map(function (order) {
        var items = orderItems(order);
        var status = buyerStatus(order.status);
        var image = items.length ? itemImage(items[0]) : '<span class="market-thumb">' + escapeHtml(t("無圖片", "No image")) + "</span>";
        return "<tr><td class=\"market-order-no\" title=\"" + escapeHtml(order.id) + "\">" + escapeHtml(String(order.id || "").slice(0, 8)) +
          "</td><td>" + image + "</td><td>" + escapeHtml(orderHeadline(order)) +
          "</td><td>" + orderQty(order) + "</td><td>" + escapeHtml(money(order.total)) +
          "</td><td><span class=\"market-status-pill is-" + status.key + "\">" + escapeHtml(t(status.zh, status.en)) + "</span></td><td>" +
          '<button type="button" class="btn btn-outline" data-order-overview="' + order.id + '">' +
          t("商品總覽", "View items") + "</button></td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      (open ? orderOverview(open) : "");
  }

  function sellerAction(order) {
    if (order.status === "awaiting_payment") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="payment_confirmed">' +
        t("確認付款", "Confirm payment") + "</button>";
    }
    if (order.status === "payment_confirmed") {
      return '<button type="button" class="btn btn-gold" data-advance="' + order.id + '" data-next="ready_to_ship">' +
        t("移到待出貨", "Move to ready to ship") + "</button>";
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
    function bucket(titleZh, titleEn, list) {
      return '<section class="market-bucket"><h3>' + t(titleZh, titleEn) + " · " + list.length + "</h3>" +
        (list.length ? list.map(function (order) { return orderCard(order, sellerAction(order), "seller"); }).join("") :
          '<p class="market-empty">' + escapeHtml(t("目前沒有訂單。", "There are no orders at the moment.")) + "</p>") +
        "</section>";
    }
    host.innerHTML =
      bucket("待確認付款", "Pending payments", mine.filter(function (order) { return order.status === "awaiting_payment"; })) +
      bucket("已確認付款", "Payment confirmed", mine.filter(function (order) { return order.status === "payment_confirmed"; })) +
      bucket("待出貨", "Pending shipments", mine.filter(function (order) { return order.status === "ready_to_ship" || order.status === "shipped"; })) +
      bucket("已到貨", "Arrived", mine.filter(function (order) { return order.status === "arrived"; })) +
      bucket("已完成", "Completed orders", mine.filter(function (order) { return order.status === "completed"; }));
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

  function filteredAdminOrders() {
    var query = (document.getElementById("market-order-q").value || "").trim().toLowerCase();
    var status = document.getElementById("market-status-filter").value;
    return orders.filter(function (order) {
      if (query && String(order.id).toLowerCase().indexOf(query) === -1) return false;
      if (status === "all") return true;
      if (status === "incomplete") return order.status !== "completed";
      return order.status === status;
    });
  }

  function renderAdmin() {
    var list = filteredAdminOrders();
    var amount = list.reduce(function (sum, order) { return sum + Number(order.total || 0); }, 0);
    var fees = list.reduce(function (sum, order) { return sum + Number(order.platform_fee || 0); }, 0);
    document.getElementById("market-admin-stats").textContent = t(
      "交易筆數 " + list.length + " / 交易金額 " + money(amount) + " / 平台手續費 " + money(fees),
      "Transactions: " + list.length + " / Total amount: " + money(amount) + " / Platform fees: " + money(fees)
    );
    document.getElementById("market-fee").value = fee;
    document.getElementById("market-fee-form").hidden = !isSuper();
    document.getElementById("market-admin-list").innerHTML = list.length
      ? list.map(function (order) {
          return orderCard(order, "", "admin");
        }).join("")
      : '<p class="market-empty">' + escapeHtml(t("沒有符合的交易。", "No matching transactions.")) + "</p>";
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
    fillSelect(document.getElementById("market-status-filter"), [
      { value: "all", zh: "全部", en: "All" },
      { value: "incomplete", zh: "未完成", en: "Incomplete" },
      { value: "awaiting_payment", zh: "待確認付款", en: "Waiting for payment" },
      { value: "payment_confirmed", zh: "已確認付款", en: "Payment confirmed" },
      { value: "ready_to_ship", zh: "待出貨", en: "Ready to ship" },
      { value: "shipped", zh: "已出貨", en: "Shipped" },
      { value: "arrived", zh: "已到貨", en: "Arrived" },
      { value: "completed", zh: "已完成", en: "Completed" }
    ]);
    document.title = t(
      "同學市集 | 國際經營管理碩士班（imMBA）",
      "C2C Marketplace | International Management (imMBA)"
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
    setView("listings");
    openForm(null);
    renderChrome();
  });
  document.getElementById("market-category-filter").addEventListener("change", renderListings);
  document.getElementById("market-month").addEventListener("change", renderAccounting);
  document.getElementById("market-order-q").addEventListener("input", renderAdmin);
  document.getElementById("market-status-filter").addEventListener("change", renderAdmin);
  document.getElementById("market-fee-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var next = Number(document.getElementById("market-fee").value);
    if (next < 0) return;
    var result = await auth.getClient().from("market_settings").update({ platform_fee: next }).eq("id", 1);
    if (result.error) {
      showStatus("手續費儲存失敗：" + result.error.message, "Could not save the fee: " + result.error.message, "err");
      return;
    }
    fee = next;
    showStatus("平台手續費已更新。新的訂單會使用這個金額。", "Platform fee saved. New orders use this amount.", "ok");
    renderAdmin();
  });
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
      mode = modeButton.getAttribute("data-mode") === "seller" ? "seller" : "buyer";
      localStorage.setItem(MODE_KEY, mode);
      if (mode === "buyer") setView("listings");
      if (mode === "seller" && (view === "cart" || view === "member" || view === "pay")) setView("listings");
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
      showStatus("已加入購物車。", "Added to cart.", "ok");
      setView("cart");
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
    if (event.target.id === "market-to-pay" || event.target.closest("#market-to-pay")) {
      if (!cartLines().length) {
        showStatus("購物車是空的。", "Your cart is empty.", "err");
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
      delete cartNow[removeButton.getAttribute("data-remove")];
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

  async function checkout() {
    if (!canTrade()) {
      location.href = "login.html?next=books.html";
      return;
    }
    var cart = readCart();
    var groups = {};
    Object.keys(cart).forEach(function (id) {
      var product = productById(id);
      var quantity = Number(cart[id]) || 0;
      if (!product || quantity < 1) return;
      var seller = product.seller_id;
      if (!groups[seller]) groups[seller] = [];
      groups[seller].push({ product_id: id, quantity: quantity });
    });
    var sellers = Object.keys(groups);
    if (!sellers.length) {
      showStatus("購物車是空的。", "Your cart is empty.", "err");
      return;
    }
    var shipping = "pickup";
    document.querySelectorAll('input[name="market-ship"]').forEach(function (input) {
      if (input.checked) shipping = input.value;
    });
    var sb = auth.getClient();
    for (var i = 0; i < sellers.length; i += 1) {
      var placed = await sb.rpc("place_market_order", {
        p_items: groups[sellers[i]],
        p_shipping: shipping
      });
      if (placed.error) {
        showStatus("下單失敗：" + placed.error.message, "Checkout failed: " + placed.error.message, "err");
        return;
      }
    }
    writeCart({});
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
