(function (global) {
  var TABLE = "faculty";
  var PHOTO_BUCKET = "faculty-photos";
  var client = null;

  function getClient() {
    if (client) return client;
    var cfg = global.ImMbaSupabaseConfig;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      throw new Error("Missing ImMbaSupabaseConfig (url / anonKey).");
    }
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("Supabase JS SDK not loaded.");
    }
    client = global.supabase.createClient(cfg.url, cfg.anonKey);
    return client;
  }

  function normalizeRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: String(row.name || "").trim(),
      title: String(row.title || "").trim(),
      education: String(row.education || "").trim(),
      research_fields: String(row.research_fields || "").trim(),
      email: String(row.email || "").trim(),
      phone: String(row.phone || "").trim(),
      website: String(row.website || "").trim(),
      image_url: String(row.image_url || "").trim(),
      category: row.category === "adjunct" ? "adjunct" : "full",
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  function payloadFromInput(input) {
    return {
      name: String(input.name || "").trim(),
      title: String(input.title || "").trim() || null,
      education: String(input.education || "").trim() || null,
      research_fields: String(input.research_fields || "").trim() || null,
      email: String(input.email || "").trim() || null,
      phone: String(input.phone || "").trim() || null,
      website: String(input.website || "").trim() || null,
      image_url: String(input.image_url || "").trim() || null,
      category: input.category === "adjunct" ? "adjunct" : "full",
      sort_order: Number(input.sort_order) || 0
    };
  }

  /** Official-list seed (English fields match class schema / front-end labels). */
  var DEFAULT_FACULTY = [
    {
      name: "Yi-Ning Tu",
      title: "Associate Professor, Chair of MBA Program in International Management (imMBA)",
      education: "Ph.D. in Information Management, National Chengchi University, Taiwan",
      research_fields: "Data Mining, Text Mining, Artificial Intelligence, Machine Learning, Information Retrieval",
      email: "082435@mail.fju.edu.tw",
      phone: "#3988，LM208-2",
      website: "https://sites.google.com/view/yiningtu",
      image_url: "",
      category: "full",
      sort_order: 10
    },
    {
      name: "Michael T. S. Lee",
      title: "Chair Professor",
      education: "Ph.D. in Operations Research and Industrial Engineering, University of Texas at Austin, USA",
      research_fields: "Operations Research and Industrial Engineering",
      email: "036665@mail.fju.edu.tw",
      phone: "#2905，Office: SL228",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 20
    },
    {
      name: "Yaonan Lin",
      title: "Professor",
      education: "Ph.D. in Marketing, Golden Gate University, San Francisco, USA",
      research_fields: "Marketing Management",
      email: "065999@mail.fju.edu.tw",
      phone: "#2735, 2021",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 30
    },
    {
      name: "Yu-Ming Hsu",
      title: "Associate Professor, Director of MS Program in Technology Management",
      education: "Ph.D. in International Business, National Taiwan University, Taiwan",
      research_fields: "Marketing Management, Digital Marketing, Information Technology Marketing, Social Commerce, International Business Administration",
      email: "155456@mail.fju.edu.tw",
      phone: "#3977，SL225",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 40
    },
    {
      name: "Chih-An Lin",
      title: "Associate Professor, Director of the Academic Exchange Center",
      education: "Ph.D. in International Business, National Taiwan University, Taiwan",
      research_fields: "Supply Chain Management, Media Communication, Integrated Marketing, Brand Management",
      email: "144629@mail.fju.edu.tw",
      phone: "#2924, Office: SL221",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 50
    },
    {
      name: "Kai-Ping Huang",
      title: "Associate Professor",
      education: "Ph.D. in Business Administration, University of Technology Sydney, Australia",
      research_fields: "Business Administration",
      email: "129741@mail.fju.edu.tw",
      phone: "#2906",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 60
    },
    {
      name: "Hsiang-Ching Tseng",
      title: "Associate Professor",
      education: "Ph.D. in Marketing, National Chengchi University, Taiwan",
      research_fields: "Marketing Management",
      email: "142652@mail.fju.edu.tw",
      phone: "#2737",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 70
    },
    {
      name: "Mei-Chun Lin",
      title: "Associate Professor",
      education: "Ph.D. in Industrial and Information Management, National Cheng Kung University, Taiwan",
      research_fields: "AI application in Industry, Service Marketing, Industry Analysis and Competitive Strategy, Supply Chain Management",
      email: "151308@mail.fju.edu.tw",
      phone: "#2968, SL408",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 80
    },
    {
      name: "Shu-Ling Cheng",
      title: "Associate Professor",
      education: "Ph.D. in Business Administration, National Cheng Kung University, Taiwan",
      research_fields: "Strategic Management, Marketing Research, Data Analysis, International Financial Management",
      email: "151667@mail.fju.edu.tw",
      phone: "#2725, SL211",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 90
    },
    {
      name: "Pi-Chan Hu",
      title: "Associate Professor",
      education: "Ph.D. in Applied Linguistics, National Chengchi University, Taiwan",
      research_fields: "International Business Negotiation, English Translation, English Interpretation, Applied Linguistics, Forensic Linguistics",
      email: "128144@mail.fju.edu.tw",
      phone: "#2145",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 100
    },
    {
      name: "Shu-wen Lin",
      title: "Assistant Professor",
      education: "Ed.D., School of Education, Durham University, UK",
      research_fields: "English for General and Specific Purposes, Global Englishes",
      email: "156503@mail.fju.edu.tw",
      phone: "#3362, SF829",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 110
    },
    {
      name: "Tsui-Lin Chiang",
      title: "Assistant Professor",
      education: "Ph.D. in Business Administration, Fu Jen Catholic University, Taiwan",
      research_fields: "Economics, Business governance, Financial Management, Investment",
      email: "051266@mail.fju.edu.tw",
      phone: "#3998, SL424",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 120
    },
    {
      name: "Meng-Hsien Yen",
      title: "Assistant Professor",
      education: "Ph.D. in Business Policy, National Cheng-Chi University, Taiwan",
      research_fields: "General Management and Business Policy",
      email: "145785@mail.fju.edu.tw",
      phone: "#2648",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 130
    },
    {
      name: "Hao-Hsin Hsu",
      title: "Assistant Professor",
      education: "Ph.D. in Management Science, National Chiao Tung University, Taiwan",
      research_fields: "Organizational Behavior, Workplace Health Psychology, Human Resource Management, Efficiency and Productivity Analysis",
      email: "144779@mail.fju.edu.tw",
      phone: "#2771",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 140
    },
    {
      name: "Kai-Pin Huang",
      title: "Assistant Professor",
      education: "Ph.D. in Industrial Engineering and Management, National Chiao Tung University, Taiwan",
      research_fields: "Statistical Inference with Applications, Quality Engineering and Reliability Analysis, Data Mining and Machine Learning, Artificial Intelligence System Applications in Renewable Energy Management",
      email: "152400@mail.fju.edu.tw",
      phone: "#6265",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 150
    },
    {
      name: "Lai Ferry Sugianto",
      title: "Assistant Professor",
      education: "Ph.D. in Finance, National Chung Cheng University, Taiwan",
      research_fields: "Investment, Behavioral Finance, Environmental Finance and Economics, Green Finance, Climate Finance, ESG",
      email: "158325@mail.fju.edu.tw",
      phone: "#2678",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 160
    },
    {
      name: "Tsang-Hsien Wang",
      title: "Assistant Professor",
      education: "Ph.D in Management, National Taiwan University of Science and Technology",
      research_fields: "Consumer Behavior, Marketing Management, Innovation and Product Management, International Business Management, Brand Management",
      email: "167167@mail.fju.edu.tw",
      phone: "#3931",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 170
    },
    {
      name: "Chia-Hua Lin",
      title: "Assistant Professor",
      education: "Ph.D. in Psychology, National Chung Cheng University",
      research_fields: "Organizational Behavior, Industrial and Organizational Psychology",
      email: "167208@mail.fju.edu.tw",
      phone: "#2966",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 180
    },
    {
      name: "Hui-Mei Wang",
      title: "Part-time Associate Professor",
      education: "Ph. D. in International Business, National Taiwan University, Taiwan",
      research_fields: "International Business, International Marketing",
      email: "wanghm.tw@gmail.com",
      phone: "",
      website: "",
      image_url: "",
      category: "adjunct",
      sort_order: 200
    }
  ];

  async function listFaculty() {
    var sb = getClient();
    var result = await sb
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (result.error) throw result.error;
    return (result.data || []).map(normalizeRow);
  }

  async function createFaculty(input) {
    var sb = getClient();
    var payload = payloadFromInput(input);
    var result = await sb.from(TABLE).insert(payload).select().single();
    if (result.error) throw result.error;
    return normalizeRow(result.data);
  }

  async function updateFaculty(id, input) {
    var sb = getClient();
    var payload = payloadFromInput(input);
    var result = await sb.from(TABLE).update(payload).eq("id", id).select().single();
    if (result.error) throw result.error;
    return normalizeRow(result.data);
  }

  async function deleteFaculty(id) {
    var sb = getClient();
    var result = await sb.from(TABLE).delete().eq("id", id);
    if (result.error) throw result.error;
  }

  async function reorderFaculty(orderedIds) {
    var sb = getClient();
    var updates = orderedIds.map(function (id, index) {
      return sb.from(TABLE).update({ sort_order: (index + 1) * 10 }).eq("id", id);
    });
    var results = await Promise.all(updates);
    for (var i = 0; i < results.length; i++) {
      if (results[i].error) throw results[i].error;
    }
    return listFaculty();
  }

  async function seedDefaultsIfEmpty() {
    var existing = await listFaculty();
    if (existing.length) return { seeded: false, count: existing.length, list: existing };
    var sb = getClient();
    var result = await sb.from(TABLE).insert(DEFAULT_FACULTY).select();
    if (result.error) throw result.error;
    var list = (result.data || []).map(normalizeRow);
    return { seeded: true, count: list.length, list: list };
  }

  async function replaceWithDefaults() {
    var sb = getClient();
    var existing = await listFaculty();
    if (existing.length) {
      var ids = existing.map(function (row) { return row.id; });
      var del = await sb.from(TABLE).delete().in("id", ids);
      if (del.error) throw del.error;
    }
    var result = await sb.from(TABLE).insert(DEFAULT_FACULTY).select();
    if (result.error) throw result.error;
    return (result.data || []).map(normalizeRow);
  }

  function isChair(row) {
    return row && (
      String(row.email || "").toLowerCase() === "082435@mail.fju.edu.tw" ||
      /yi-?ning\s*tu/i.test(String(row.name || ""))
    );
  }

  function safeFileName(name) {
    return String(name || "photo")
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "photo";
  }

  function extensionFromFile(file) {
    var fromName = (file && file.name && file.name.split(".").pop()) || "";
    fromName = String(fromName).toLowerCase();
    if (/^(jpe?g|png|webp|gif)$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
    if (file && file.type === "image/png") return "png";
    if (file && file.type === "image/webp") return "webp";
    if (file && file.type === "image/gif") return "gif";
    return "jpg";
  }

  /**
   * Upload a faculty photo to Supabase Storage and return its public URL.
   * @param {File} file
   * @param {{ name?: string, id?: string|number }} [meta]
   */
  async function uploadPhoto(file, meta) {
    if (!file) throw new Error("No file selected.");
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      throw new Error("Only JPG, PNG, WEBP, or GIF images are allowed.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image must be 5 MB or smaller.");
    }

    var sb = getClient();
    var stamp = Date.now().toString(36);
    var base = safeFileName((meta && meta.name) || file.name);
    var idPart = meta && meta.id != null ? String(meta.id) + "-" : "";
    var path = "faculty/" + idPart + stamp + "-" + base + "." + extensionFromFile(file);

    var result = await sb.storage.from(PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (result.error) {
      var msg = result.error.message || String(result.error);
      var code = result.error.statusCode || result.error.error || "";
      if (/bucket not found|NoSuchBucket/i.test(msg + " " + code)) {
        throw new Error(
          "Storage bucket「faculty-photos」尚未建立。請先在 Supabase SQL Editor 執行專案裡的 storage.sql。"
        );
      }
      if (/row-level security|policy|permission|unauthorized|403/i.test(msg + " " + code)) {
        throw new Error(
          "Storage 權限不足。請確認已執行 storage.sql（含 upload policy）。詳情：" + msg
        );
      }
      throw new Error(msg);
    }

    var pub = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : "";
    if (!url) throw new Error("Upload succeeded but public URL is missing.");
    return { path: path, publicUrl: url };
  }

  global.ImMbaFaculty = {
    list: listFaculty,
    create: createFaculty,
    update: updateFaculty,
    remove: deleteFaculty,
    reorder: reorderFaculty,
    seedDefaultsIfEmpty: seedDefaultsIfEmpty,
    replaceWithDefaults: replaceWithDefaults,
    uploadPhoto: uploadPhoto,
    isChair: isChair,
    defaults: DEFAULT_FACULTY,
    photoBucket: PHOTO_BUCKET
  };
})(window);
