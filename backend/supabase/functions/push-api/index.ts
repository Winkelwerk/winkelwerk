import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-code, x-employee-code",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("PRIVATE_SERVICE_ROLE_KEY") ?? "";
const adminCodeHash = Deno.env.get("ADMIN_CODE_HASH") ?? "";
const employeeCodeHash = Deno.env.get("EMPLOYEE_CODE_HASH") || "9d9e2a5d80f2e01d90f7df18998d0a5e99dab05875d7c2ef67d4deda9350b786";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidContactEmail = Deno.env.get("VAPID_CONTACT_EMAIL") ?? "admin@example.com";
const defaultMaintenanceMessage = "Website wird gerade bearbeitet. Bitte später erneut versuchen.";

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
}

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn("VAPID keys are missing.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

async function sha256(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

function getAction(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1) ?? "";
  return last === "push-api" ? "" : last;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function normalizeInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeItemType(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "drink" || normalized === "getraenk" || normalized === "getränk") {
    return "drink";
  }

  if (normalized === "poster") {
    return "poster";
  }

  if (normalized === "sticker" || normalized === "stickers") {
    return "sticker";
  }

  return "food";
}

function looksLikeDrink(record: Record<string, any>) {
  const category = normalizeText(record.category).toLowerCase();
  const title = normalizeText(record.title).toLowerCase();
  const description = normalizeText(record.description).toLowerCase();
  const badge = normalizeText(record.badge).toLowerCase();
  const haystack = [title, category, badge, description].join(" ");
  const drinkCategoryHints = new Set([
    "drink",
    "drinks",
    "getraenk",
    "getränk",
    "kalt",
    "heiss",
    "heiß",
    "mocktail",
    "hausbar",
    "bar",
    "kaffee",
    "tee",
    "softdrink",
    "softdrinks"
  ]);
  const drinkTitlePattern = /(espresso|cappuccino|latte|macchiato|mokka|limonade|spritz|spritzer|tonic|cola|fanta|sprite|wasser|saft|schorle|shake|smoothie|cocktail|mocktail|bier|wein|aperol|gin|rum|tee|kaffee|chai|matcha)/i;

  return drinkCategoryHints.has(category) || drinkTitlePattern.test(haystack);
}

function inferItemType(record: Record<string, any>) {
  const explicitType = normalizeText(record.item_type).toLowerCase();

  if (["drink", "food", "poster", "sticker"].includes(explicitType)) {
    return explicitType;
  }

  return looksLikeDrink(record) ? "drink" : "food";
}

function normalizeMenuPeriods(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? normalizeText(value).replace(/^\{|\}$/g, "").split(",")
      : [value];

  const uniqueValues = Array.from(new Set(
    rawValues
      .map((item) => normalizeText(item).toLowerCase())
      .filter((item) => ["all_day", "breakfast", "lunch", "dinner"].includes(item))
  ));

  if (!uniqueValues.length || uniqueValues.includes("all_day")) {
    return ["all_day"];
  }

  return ["breakfast", "lunch", "dinner"].filter((item) => uniqueValues.includes(item));
}

function getPrimaryMenuPeriod(value: unknown) {
  return normalizeMenuPeriods(value)[0] ?? "all_day";
}

function mapMenuItem(record: Record<string, any>) {
  const menuPeriods = normalizeMenuPeriods(record.menu_periods ?? record.menu_period);

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    imageUrl: record.image_url ?? "",
    price: record.price ?? "",
    category: record.category ?? "",
    badge: record.badge ?? "",
    ctaLabel: record.cta_label ?? "",
    ctaUrl: record.cta_url ?? "",
    itemType: inferItemType(record),
    menuPeriod: getPrimaryMenuPeriod(menuPeriods),
    menuPeriods,
    sortOrder: Number(record.sort_order ?? 0),
    isActive: Boolean(record.is_active),
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

function mapSiteSettings(record?: Record<string, any> | null) {
  return {
    maintenanceMode: Boolean(record?.maintenance_mode),
    maintenanceMessage: normalizeText(record?.maintenance_message) || defaultMaintenanceMessage,
    updatedAt: record?.updated_at ?? null
  };
}

function mapPushSubscription(record: Record<string, any>) {
  return {
    endpoint: record.endpoint,
    site: record.site ?? "",
    page: record.page ?? "",
    userAgent: record.user_agent ?? "",
    createdAt: record.created_at ?? null,
    updatedAt: record.updated_at ?? null,
    lastSeenAt: record.last_seen_at ?? null
  };
}

function mapOrderRequest(record: Record<string, any>) {
  const items = Array.isArray(record.items) ? record.items : [];

  return {
    id: record.id,
    customerName: record.customer_name ?? "",
    customerContact: record.customer_contact ?? "",
    pickupTime: record.pickup_time ?? "",
    notes: record.notes ?? "",
    items,
    itemCount: items.reduce((total, item) => total + Number(item?.quantity ?? 0), 0),
    sourcePage: record.source_page ?? "",
    totalText: record.total_text ?? "",
    totalValue: Number(record.total_value ?? 0),
    status: record.status ?? "new",
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

function isMissingRelationError(error: unknown, relationName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const details = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const haystack = [details.message, details.details, details.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const normalizedRelation = relationName.toLowerCase();

  return details.code === "42P01"
    || haystack.includes(`relation "${normalizedRelation}" does not exist`)
    || haystack.includes(`relation '${normalizedRelation}' does not exist`);
}

async function validateAdminRequest(request: Request) {
  const incomingCode = normalizeText(request.headers.get("x-admin-code"));

  if (!incomingCode) {
    return jsonResponse({ error: "Missing admin code." }, 401);
  }

  const incomingHash = await sha256(incomingCode);

  if (!adminCodeHash || incomingHash !== adminCodeHash) {
    return jsonResponse({ error: "Invalid admin code." }, 403);
  }

  return null;
}

async function validateStaffRequest(request: Request) {
  const incomingAdminCode = normalizeText(request.headers.get("x-admin-code"));
  const incomingEmployeeCode = normalizeText(request.headers.get("x-employee-code"));

  if (!incomingAdminCode && !incomingEmployeeCode) {
    return jsonResponse({ error: "Missing staff code." }, 401);
  }

  const incomingAdminHash = incomingAdminCode ? await sha256(incomingAdminCode) : "";
  const incomingEmployeeHash = incomingEmployeeCode ? await sha256(incomingEmployeeCode) : "";
  const validAdminCode = Boolean(adminCodeHash && incomingAdminHash === adminCodeHash);
  const validEmployeeCode = Boolean(employeeCodeHash && incomingEmployeeHash === employeeCodeHash);

  if (!validAdminCode && !validEmployeeCode) {
    return jsonResponse({ error: "Invalid staff code." }, 403);
  }

  return null;
}

function normalizeOrderStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();

  if (["new", "in_progress", "ready", "completed", "cancelled"].includes(normalized)) {
    return normalized;
  }

  return "new";
}

async function listMenuItems(itemTypeOrIncludeInactive: unknown = false, includeInactive = false) {
  const filterByType = typeof itemTypeOrIncludeInactive === "string"
    ? normalizeItemType(itemTypeOrIncludeInactive)
    : null;
  const shouldIncludeInactive = typeof itemTypeOrIncludeInactive === "boolean"
    ? itemTypeOrIncludeInactive
    : includeInactive;

  let query = supabase
    .from("menu_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!shouldIncludeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const items = (data ?? []).map(mapMenuItem);

  if (filterByType) {
    return items.filter((item) => item.itemType === filterByType);
  }

  return items;
}

async function getNextMenuSortOrder() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return Number(data?.[0]?.sort_order ?? -1) + 1;
}

async function getSiteSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "site_settings")) {
      return {
        settings: mapSiteSettings(null),
        storageReady: false
      };
    }

    throw error;
  }

  return {
    settings: mapSiteSettings(data),
    storageReady: true
  };
}

async function listPushSubscriptions() {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, site, page, user_agent, created_at, updated_at, last_seen_at")
    .order("last_seen_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapPushSubscription);
}

async function listOrderRequests() {
  const { data, error } = await supabase
    .from("order_requests")
    .select("id, customer_name, customer_contact, pickup_time, notes, items, source_page, total_text, total_value, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, "order_requests")) {
      return {
        orders: [],
        storageReady: false
      };
    }

    throw error;
  }

  return {
    orders: (data ?? []).map(mapOrderRequest),
    storageReady: true
  };
}

function ensureSubscription(body: any) {
  const subscription = body?.subscription;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("Missing subscription payload.");
  }

  return subscription;
}

function normalizeOrderItems(value: unknown) {
  const rawItems = Array.isArray(value) ? value : [];

  return rawItems
    .map((item) => {
      const quantity = Math.max(1, normalizeInteger(item?.quantity, 1));
      const priceValue = Number(item?.priceValue);
      const lineTotalValue = Number(item?.lineTotalValue);
      const normalizedPriceValue = Number.isFinite(priceValue) ? priceValue : 0;

      return {
        id: normalizeText(item?.id),
        title: normalizeText(item?.title),
        description: normalizeOptionalText(item?.description),
        itemType: normalizeItemType(item?.itemType ?? item?.type),
        category: normalizeOptionalText(item?.category),
        badge: normalizeOptionalText(item?.badge),
        quantity,
        priceText: normalizeOptionalText(item?.priceText ?? item?.price),
        priceValue: normalizedPriceValue,
        lineTotalText: normalizeOptionalText(item?.lineTotalText),
        lineTotalValue: Number.isFinite(lineTotalValue) ? lineTotalValue : normalizedPriceValue * quantity
      };
    })
    .filter((item) => Boolean(item.title));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const action = getAction(new URL(request.url).pathname);

  try {
    if (action === "menu") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      const items = await listMenuItems("food");
      return jsonResponse({ ok: true, items });
    }

    if (action === "drinks") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      const items = await listMenuItems("drink");
      return jsonResponse({ ok: true, items });
    }

    if (action === "print-products") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      const requestedType = normalizeText(new URL(request.url).searchParams.get("type")).toLowerCase();
      const productType = requestedType === "poster" || requestedType === "sticker" ? requestedType : "";
      const items = await listMenuItems();
      const printProducts = items.filter((item) => {
        const isPrintProduct = item.itemType === "poster" || item.itemType === "sticker";
        return isPrintProduct && (!productType || item.itemType === productType);
      });
      return jsonResponse({ ok: true, items: printProducts });
    }

    if (action === "staff-auth") {
      const staffError = await validateStaffRequest(request);

      if (staffError) {
        return staffError;
      }

      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      return jsonResponse({ ok: true });
    }

    if (action === "site-settings") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      const siteSettings = await getSiteSettings();
      return jsonResponse({ ok: true, ...siteSettings });
    }

    if (action === "menu-admin") {
      const staffError = await validateStaffRequest(request);

      if (staffError) {
        return staffError;
      }

      if (request.method === "GET") {
        const items = await listMenuItems(true);
        return jsonResponse({ ok: true, items });
      }

      const body = await request.json();
      const operation = normalizeText(body?.operation).toLowerCase();

      if (operation === "save") {
        const title = normalizeText(body?.title);
        const description = normalizeText(body?.description);
        const hasSortOrder = String(body?.sortOrder ?? "").trim() !== "";
        const sortOrder = hasSortOrder
          ? normalizeInteger(body?.sortOrder, 0)
          : await getNextMenuSortOrder();
        const itemType = normalizeItemType(body?.itemType);
        const menuPeriods = itemType === "food"
          ? normalizeMenuPeriods(body?.menuPeriods ?? body?.menuPeriod)
          : ["all_day"];

        if (!title || !description) {
          return jsonResponse({ error: "Title and description are required." }, 400);
        }

        const payload = {
          title,
          description,
          image_url: normalizeOptionalText(body?.imageUrl),
          price: normalizeOptionalText(body?.price),
          category: normalizeOptionalText(body?.category),
          badge: normalizeOptionalText(body?.badge),
          cta_label: normalizeOptionalText(body?.ctaLabel),
          cta_url: normalizeOptionalText(body?.ctaUrl),
          item_type: itemType,
          menu_period: getPrimaryMenuPeriod(menuPeriods),
          menu_periods: menuPeriods,
          sort_order: sortOrder,
          is_active: body?.isActive === undefined ? true : normalizeBoolean(body?.isActive),
          updated_at: new Date().toISOString()
        };

        const itemId = normalizeText(body?.id);
        const result = itemId
          ? await supabase
            .from("menu_items")
            .update(payload)
            .eq("id", itemId)
            .select("*")
            .single()
          : await supabase
            .from("menu_items")
            .insert(payload)
            .select("*")
            .single();

        if (result.error || !result.data) {
          throw result.error ?? new Error("Menu item save failed.");
        }

        return jsonResponse({
          ok: true,
          item: mapMenuItem(result.data)
        });
      }

      if (operation === "delete") {
        const itemId = normalizeText(body?.id);

        if (!itemId) {
          return jsonResponse({ error: "Missing menu item id." }, 400);
        }

        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", itemId);

        if (error) {
          throw error;
        }

        return jsonResponse({ ok: true });
      }

      if (operation === "reorder") {
        const items = Array.isArray(body?.items) ? body.items : [];

        if (!items.length) {
          return jsonResponse({ error: "Missing reorder payload." }, 400);
        }

        const timestamp = new Date().toISOString();
        const updateResults = await Promise.all(items.map((item: any, index: number) => {
          const itemId = normalizeText(item?.id);

          if (!itemId) {
            return Promise.resolve({ error: new Error("Missing menu item id.") });
          }

          return supabase
            .from("menu_items")
            .update({
              sort_order: normalizeInteger(item?.sortOrder, index),
              updated_at: timestamp
            })
            .eq("id", itemId);
        }));

        const failedUpdate = updateResults.find((result) => result.error);

        if (failedUpdate?.error) {
          throw failedUpdate.error;
        }

        const freshItems = await listMenuItems(true);
        return jsonResponse({ ok: true, items: freshItems });
      }

      return jsonResponse({ error: "Unknown admin menu operation." }, 400);
    }

    if (action === "orders") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }

      const body = await request.json();
      const customerName = normalizeText(body?.customerName);
      const customerContact = normalizeText(body?.customerContact);
      const pickupTime = normalizeOptionalText(body?.pickupTime);
      const notes = normalizeOptionalText(body?.notes);
      const sourcePage = normalizeOptionalText(body?.sourcePage);
      const totalText = normalizeOptionalText(body?.totalText);
      const totalValue = Number(body?.totalValue);
      const items = normalizeOrderItems(body?.items);

      if (!customerName || !customerContact || !items.length) {
        return jsonResponse({ error: "Name, contact and at least one item are required." }, 400);
      }

      const result = await supabase
        .from("order_requests")
        .insert({
          customer_name: customerName,
          customer_contact: customerContact,
          pickup_time: pickupTime,
          notes,
          items,
          source_page: sourcePage,
          total_text: totalText,
          total_value: Number.isFinite(totalValue) ? totalValue : 0,
          status: "new",
          updated_at: new Date().toISOString()
        })
        .select("id, customer_name, customer_contact, pickup_time, notes, items, source_page, total_text, total_value, status, created_at, updated_at")
        .single();

      if (result.error || !result.data) {
        if (result.error && isMissingRelationError(result.error, "order_requests")) {
          return jsonResponse({
            error: "Die Tabelle order_requests fehlt. Bitte fuehre die neue Migration aus und deploye push-api neu."
          }, 503);
        }

        throw result.error ?? new Error("Order save failed.");
      }

      return jsonResponse({
        ok: true,
        order: mapOrderRequest(result.data)
      });
    }

    if (action === "site-settings-admin") {
      const adminError = await validateAdminRequest(request);

      if (adminError) {
        return adminError;
      }

      if (request.method === "GET") {
        const siteSettings = await getSiteSettings();
        return jsonResponse({ ok: true, ...siteSettings });
      }

      const body = await request.json();
      const maintenanceMode = normalizeBoolean(body?.maintenanceMode);
      const maintenanceMessage = normalizeText(body?.maintenanceMessage) || defaultMaintenanceMessage;

      const result = await supabase
        .from("site_settings")
        .upsert({
          id: 1,
          maintenance_mode: maintenanceMode,
          maintenance_message: maintenanceMessage,
          updated_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (result.error || !result.data) {
        if (result.error && isMissingRelationError(result.error, "site_settings")) {
          return jsonResponse({
            error: "Die Tabelle site_settings fehlt. Bitte führe die Migration 20260429_site_settings.sql aus und deploye push-api neu."
          }, 503);
        }

        throw result.error ?? new Error("Site settings save failed.");
      }

      return jsonResponse({
        ok: true,
        settings: mapSiteSettings(result.data)
      });
    }

    if (action === "subscriptions-admin") {
      const adminError = await validateAdminRequest(request);

      if (adminError) {
        return adminError;
      }

      if (request.method === "GET") {
        const subscriptions = await listPushSubscriptions();
        return jsonResponse({ ok: true, subscriptions });
      }

      const body = await request.json();
      const operation = normalizeText(body?.operation).toLowerCase();

      if (operation === "delete") {
        const endpoint = normalizeText(body?.endpoint);

        if (!endpoint) {
          return jsonResponse({ error: "Missing endpoint." }, 400);
        }

        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);

        if (error) {
          throw error;
        }

        return jsonResponse({ ok: true });
      }

      return jsonResponse({ error: "Unknown subscription admin operation." }, 400);
    }

    if (action === "orders-admin") {
      const staffError = await validateStaffRequest(request);

      if (staffError) {
        return staffError;
      }

      if (request.method === "GET") {
        const ordersResult = await listOrderRequests();
        return jsonResponse({ ok: true, ...ordersResult });
      }

      const body = await request.json();
      const operation = normalizeText(body?.operation).toLowerCase();

      if (operation === "delete") {
        const orderId = normalizeInteger(body?.id, 0);

        if (!orderId) {
          return jsonResponse({ error: "Missing order id." }, 400);
        }

        const { error } = await supabase
          .from("order_requests")
          .delete()
          .eq("id", orderId);

        if (error) {
          if (isMissingRelationError(error, "order_requests")) {
            return jsonResponse({
              error: "Die Tabelle order_requests fehlt. Bitte fuehre die neue Migration aus und deploye push-api neu."
            }, 503);
          }

          throw error;
        }

        return jsonResponse({ ok: true });
      }

      if (operation === "update-status") {
        const orderId = normalizeInteger(body?.id, 0);

        if (!orderId) {
          return jsonResponse({ error: "Missing order id." }, 400);
        }

        const result = await supabase
          .from("order_requests")
          .update({
            status: normalizeOrderStatus(body?.status),
            updated_at: new Date().toISOString()
          })
          .eq("id", orderId)
          .select("id, customer_name, customer_contact, pickup_time, notes, items, source_page, total_text, total_value, status, created_at, updated_at")
          .single();

        if (result.error || !result.data) {
          if (result.error && isMissingRelationError(result.error, "order_requests")) {
            return jsonResponse({
              error: "Die Tabelle order_requests fehlt. Bitte fuehre die neue Migration aus und deploye push-api neu."
            }, 503);
          }

          throw result.error ?? new Error("Order status update failed.");
        }

        return jsonResponse({
          ok: true,
          order: mapOrderRequest(result.data)
        });
      }

      return jsonResponse({ error: "Unknown order admin operation." }, 400);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    if (action === "subscribe") {
      const body = await request.json();
      const subscription = ensureSubscription(body);

      const { error } = await supabase.from("push_subscriptions").upsert({
        endpoint: subscription.endpoint,
        subscription,
        site: normalizeOptionalText(body?.site),
        page: normalizeOptionalText(body?.page),
        user_agent: normalizeOptionalText(body?.userAgent),
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      }, {
        onConflict: "endpoint"
      });

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "unsubscribe") {
      const body = await request.json();

      if (!body?.endpoint) {
        return jsonResponse({ error: "Missing endpoint." }, 400);
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", body.endpoint);

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "send") {
      const body = await request.json();
      const adminError = await validateAdminRequest(request);

      if (adminError) {
        return adminError;
      }

      const webpush = (await import("npm:web-push@3.6.7")).default;
      webpush.setVapidDetails(`mailto:${vapidContactEmail}`, vapidPublicKey, vapidPrivateKey);

      const title = String(body?.title ?? "").trim();
      const messageBody = String(body?.body ?? "").trim();
      const url = String(body?.url ?? "").trim();

      if (!title || !messageBody || !url) {
        return jsonResponse({ error: "Title, body and url are required." }, 400);
      }

      const insertResult = await supabase
        .from("internal_messages")
        .insert({
          title,
          body: messageBody,
          url
        })
        .select("id, title, body, url, created_at")
        .single();

      if (insertResult.error || !insertResult.data) {
        throw insertResult.error ?? new Error("Message insert failed.");
      }

      const message = insertResult.data;

      const subscriptionsResult = await supabase
        .from("push_subscriptions")
        .select("endpoint, subscription");

      if (subscriptionsResult.error) {
        throw subscriptionsResult.error;
      }

      const staleEndpoints: string[] = [];
      const sendResults = await Promise.all(
        (subscriptionsResult.data ?? []).map(async (record) => {
          try {
            await webpush.sendNotification(record.subscription as any, JSON.stringify({
              id: `msg-${message.id}`,
              title: message.title,
              body: message.body,
              url: message.url,
              sentAt: message.created_at,
              source: "admin"
            }));

            return true;
          } catch (error: any) {
            const statusCode = error?.statusCode ?? error?.status ?? 0;

            if (statusCode === 404 || statusCode === 410) {
              staleEndpoints.push(record.endpoint);
            } else {
              console.error("Push send failed", error);
            }

            return false;
          }
        })
      );

      const sentCount = sendResults.filter(Boolean).length;

      if (staleEndpoints.length) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .in("endpoint", staleEndpoints);
      }

      return jsonResponse({
        ok: true,
        sentCount,
        staleRemoved: staleEndpoints.length,
        messageId: message.id
      });
    }

    return jsonResponse({ error: "Unknown action." }, 404);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Server error." }, 500);
  }
});
