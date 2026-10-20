(function (global) {
  var TABLE = "faculty";
  var PHOTO_BUCKET = "faculty-photos";
  var client = null;

  function getClient() {
    if (client) return client;
    if (global.ImMbaAuth && typeof global.ImMbaAuth.getClient === "function") {
      client = global.ImMbaAuth.getClient();
      return client;
    }
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
    var nameEn = String(row.name_en || row.name || "").trim();
    var nameZh = String(row.name_zh || "").trim();
    var titleEn = String(row.title_en || row.title || "").trim();
    var titleZh = String(row.title_zh || "").trim();
    var educationEn = String(row.education_en || row.education || "").trim();
    var educationZh = String(row.education_zh || "").trim();
    var researchEn = String(row.research_fields_en || row.research_fields || "").trim();
    var researchZh = String(row.research_fields_zh || "").trim();
    var phoneEn = String(row.phone_en || row.phone || "").trim();
    var phoneZh = String(row.phone_zh || "").trim();
    return {
      id: row.id,
      name: nameEn || nameZh,
      name_zh: nameZh,
      name_en: nameEn,
      title: titleEn || titleZh,
      title_zh: titleZh,
      title_en: titleEn,
      education: educationEn || educationZh,
      education_zh: educationZh,
      education_en: educationEn,
      research_fields: researchEn || researchZh,
      research_fields_zh: researchZh,
      research_fields_en: researchEn,
      email: String(row.email || "").trim(),
      phone: phoneEn || phoneZh,
      phone_zh: phoneZh,
      phone_en: phoneEn,
      website: String(row.website || "").trim(),
      image_url: String(row.image_url || "").trim(),
      category: row.category === "adjunct" ? "adjunct" : "full",
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  function payloadFromInput(input) {
    var nameZh = String(input.name_zh || "").trim();
    var nameEn = String(input.name_en || input.name || "").trim();
    var titleZh = String(input.title_zh || "").trim();
    var titleEn = String(input.title_en || input.title || "").trim();
    var educationZh = String(input.education_zh || "").trim();
    var educationEn = String(input.education_en || input.education || "").trim();
    var researchZh = String(input.research_fields_zh || "").trim();
    var researchEn = String(input.research_fields_en || input.research_fields || "").trim();
    var phoneZh = String(input.phone_zh || "").trim();
    var phoneEn = String(input.phone_en || input.phone || "").trim();
    return {
      // Legacy single columns stay filled for older queries / NOT NULL name
      name: nameEn || nameZh,
      title: titleEn || titleZh || null,
      education: educationEn || educationZh || null,
      research_fields: researchEn || researchZh || null,
      phone: phoneEn || phoneZh || null,
      name_zh: nameZh || null,
      name_en: nameEn || null,
      title_zh: titleZh || null,
      title_en: titleEn || null,
      education_zh: educationZh || null,
      education_en: educationEn || null,
      research_fields_zh: researchZh || null,
      research_fields_en: researchEn || null,
      phone_zh: phoneZh || null,
      phone_en: phoneEn || null,
      email: String(input.email || "").trim() || null,
      website: String(input.website || "").trim() || null,
      image_url: String(input.image_url || "").trim() || null,
      category: input.category === "adjunct" ? "adjunct" : "full",
      sort_order: Number(input.sort_order) || 0
    };
  }

  /** Official bilingual seed from Fu Jen imMBA teacher pages (ZH + EN). */
  var DEFAULT_FACULTY = [
    {
      name_zh: "杜逸寧 (統計資訊系專任)",
      name_en: "Yi-Ning Tu",
      title_zh: "副教授兼國際經營管理碩士(imMBA)主任",
      title_en: "Associate Professor, Chair of MBA Program in International Management (imMBA)",
      education_zh: "政治大學資訊管理學博士",
      education_en: "Ph.D. in Information Management, National Chengchi University, Taiwan",
      research_fields_zh: "資料探勘、文字探勘、人工智慧、機器學習、資訊檢索",
      research_fields_en: "Data Mining, Text Mining, Artificial Intelligence, Machine Learning, Information Retrieval",
      email: "082435@mail.fju.edu.tw",
      phone_zh: "#3988，LM208-2",
      phone_en: "#3988，LM208-2",
      website: "https://sites.google.com/view/yiningtu",
      image_url: "",
      category: "full",
      sort_order: 10
    },
    {
      name_zh: "李天行 (商學博士班專任)",
      name_en: "Michael T. S. Lee",
      title_zh: "講座教授 (前國際與資源發展副校長)",
      title_en: "Chair Professor",
      education_zh: "美國奧斯汀德州大學作業研究與工業工程博士",
      education_en: "Ph.D. in Operations Research and Industrial Engineering, University of Texas at Austin, USA",
      research_fields_zh: "顧客關係管理、人工智慧、應用統計、作業研究",
      research_fields_en: "Operations Research and Industrial Engineering",
      email: "036665@mail.fju.edu.tw",
      phone_zh: "#2905，研究室SL228",
      phone_en: "#2905，Office: SL228",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 20
    },
    {
      name_zh: "林耀南 (企業管理系專任)",
      name_en: "Yaonan Lin",
      title_zh: "教授(前國際教育長)",
      title_en: "Professor",
      education_zh: "美國舊金山金門大學企業管理博士",
      education_en: "Ph.D. in Marketing, Golden Gate University, San Francisco, USA",
      research_fields_zh: "消費者心理學、產品與行銷創新、創造力、人力資源管理",
      research_fields_en: "Marketing Management",
      email: "065999@mail.fju.edu.tw",
      phone_zh: "#2735，研究室SL260",
      phone_en: "# 2735, 2021",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 30
    },
    {
      name_zh: "許育銘 (金融國企系專任)",
      name_en: "Yu-Ming Hsu",
      title_zh: "副教授兼科技管理碩士學程主任",
      title_en: "Associate Professor, Director of MS Program in Technology Management",
      education_zh: "台灣大學國際企業研究所博士",
      education_en: "Ph.D. in International Business, National Taiwan University, Taiwan",
      research_fields_zh: "行銷管理、數位行銷、資訊科技行銷、社群商務、國際企業管理",
      research_fields_en: "Marketing Management, Digital Marketing, Information Technology Marketing, Social Commerce, International Business Administration",
      email: "155456@mail.fju.edu.tw",
      phone_zh: "#3977，研究室SL225",
      phone_en: "#3977，SL225",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 40
    },
    {
      name_zh: "林芷安 (金融國企系專任)",
      name_en: "Chih-An Lin",
      title_zh: "副教授兼學術交流中心主任",
      title_en: "Associate Professor, Director of the Academic Exchange Center",
      education_zh: "台灣大學國際企業博士",
      education_en: "Ph.D. in International Business, National Taiwan University, Taiwan",
      research_fields_zh: "供應鏈管理、媒體傳播、整合行銷、品牌管理",
      research_fields_en: "Supply Chain Management, Media Communication, Integrated Marketing, Brand Management",
      email: "144629@mail.fju.edu.tw",
      phone_zh: "#2924，研究室SL221",
      phone_en: "#2924, Office: SL221",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 50
    },
    {
      name_zh: "黃愷平 (企業管理系專任)",
      name_en: "Kai-Ping Huang",
      title_zh: "副教授",
      title_en: "Associate Professor",
      education_zh: "澳洲雪梨科技大學企業管理博士",
      education_en: "Ph.D. in Business Administration, University of Technology Sydney, Australia",
      research_fields_zh: "中小企業、創業精神、行銷管理、人力資源管理",
      research_fields_en: "Business Administration",
      email: "129741@mail.fju.edu.tw",
      phone_zh: "#2906",
      phone_en: "#2906",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 60
    },
    {
      name_zh: "曾祥景 (企業管理系專任)",
      name_en: "Hsiang-Ching Tseng",
      title_zh: "副教授",
      title_en: "Associate Professor",
      education_zh: "政治大學企業管理博士",
      education_en: "Ph.D. in Marketing, National Chengchi University, Taiwan",
      research_fields_zh: "行銷相關領域",
      research_fields_en: "Marketing Management",
      email: "142652@mail.fju.edu.tw",
      phone_zh: "#2737",
      phone_en: "#2737",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 70
    },
    {
      name_zh: "林玫君 (金融國企系專任)",
      name_en: "Mei-Chun Lin",
      title_zh: "副教授",
      title_en: "Associate Professor",
      education_zh: "成功大學工業與資訊管理博士",
      education_en: "Ph.D. in Industrial and Information Management, National Cheng Kung University, Taiwan",
      research_fields_zh: "產業分析與競爭策略、科技創新、服務行銷、供應鏈管理",
      research_fields_en: "AI application in Industry, Service Marketing, Industry Analysis and Competitive Strategy, Supply Chain Management",
      email: "151308@mail.fju.edu.tw",
      phone_zh: "#2968，研究室SL408",
      phone_en: "#2968, SL408",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 80
    },
    {
      name_zh: "鄭淑玲 (金融國企系專任)",
      name_en: "Shu-Ling Cheng",
      title_zh: "副教授",
      title_en: "Associate Professor",
      education_zh: "成功大學企業管理系博士",
      education_en: "Ph.D. in Business Administration, National Cheng Kung University, Taiwan",
      research_fields_zh: "行銷研究、資料分析、國際金融",
      research_fields_en: "Strategic Management, Marketing Research, Data Analysis, International Financial Management",
      email: "151667@mail.fju.edu.tw",
      phone_zh: "#2725，研究室SL211",
      phone_en: "#2725, SL211",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 90
    },
    {
      name_zh: "胡碧嬋 (跨文化研究所專任)",
      name_en: "Pi-Chan Hu",
      title_zh: "副教授(前學術交流中心主任)",
      title_en: "Associate Professor",
      education_zh: "政治大學應用英語語言學博士",
      education_en: "Ph.D. in Applied Linguistics, National Chengchi University, Taiwan",
      research_fields_zh: "國際商務談判、法律語言學、財經法律翻譯、法律口筆譯、醫療口筆譯、一般口筆譯",
      research_fields_en: "International Business Negotiation, English Translation, English Interpretation, Applied Linguistics, Forensic Linguistics",
      email: "128144@mail.fju.edu.tw",
      phone_zh: "#2145",
      phone_en: "#2145",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 100
    },
    {
      name_zh: "林淑雯",
      name_en: "Shu-wen Lin",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "英國杜倫大學教育博士",
      education_en: "Ed.D., School of Education, Durham University, UK",
      research_fields_zh: "通識及專業英文、世界性英語",
      research_fields_en: "English for General and Specific Purposes, Global Englishes",
      email: "156503@mail.fju.edu.tw",
      phone_zh: "#3362，研究室SF829",
      phone_en: "#3362, SF829",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 110
    },
    {
      name_zh: "江翠玲(金融國企系專任)",
      name_en: "Tsui-Lin Chiang",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "輔仁大學商學研究所博士",
      education_en: "Ph.D. in Business Administration, Fu Jen Catholic University, Taiwan",
      research_fields_zh: "經濟學、財務管理與公司治理、投資學與財務個案分析、國際財務管理、金融市場、信用風險管理",
      research_fields_en: "Economics, Business governance, Financial Management, Investment",
      email: "051266@mail.fju.edu.tw",
      phone_zh: "#3998, 研究室SL424",
      phone_en: "#3998, SL424",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 120
    },
    {
      name_zh: "顏孟賢(企業管理系專任)",
      name_en: "Meng-Hsien Yen",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "政治大學企業管理學系博士",
      education_en: "Ph.D. in Business Policy, National Cheng-Chi University, Taiwan",
      research_fields_zh: "一般管理、策略管理、國際企業",
      research_fields_en: "General Management and Business Policy",
      email: "145785@mail.fju.edu.tw",
      phone_zh: "#2648",
      phone_en: "#2648",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 130
    },
    {
      name_zh: "徐皓馨 (企業管理系專任)",
      name_en: "Hao-Hsin Hsu",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "交通大學管理科學系博士",
      education_en: "Ph.D. in Management Science, National Chiao Tung University, Taiwan",
      research_fields_zh: "組織行為、職場健康心理學、人力資源管理、效率及生產力分析領域",
      research_fields_en: "Organizational Behavior, Workplace Health Psychology,Human Resource Management, Efficiency and Productivity Analysis",
      email: "144779@mail.fju.edu.tw",
      phone_zh: "#2771",
      phone_en: "#2771",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 140
    },
    {
      name_zh: "黃凱斌 (企業管理系專任)",
      name_en: "Kai-Pin Huang",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "交通大學工業工程與管理學系博士",
      education_en: "Ph.D. in Industrial Engineering and Management, National Chiao Tung University, Taiwan",
      research_fields_zh: "統計推論與實務應用、品質工程及可靠度分析、資料探勘及機器學習、人工智慧於再生能源管理之應用、實驗室品質管理",
      research_fields_en: "Statistical Inference with Applications, Quality Engineering and Reliability Analysis, Data Mining and Machine Learning, Artificial Intelligence System Applications in Renewable Energy Management",
      email: "152400@mail.fju.edu.tw",
      phone_zh: "#6265",
      phone_en: "#6265",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 150
    },
    {
      name_zh: "黃慶偉 (企業管理系專任)",
      name_en: "Lai Ferry Sugianto",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "中正大學財務金融博士",
      education_en: "Ph.D. in Finance, National Chung Cheng University, Taiwan",
      research_fields_zh: "投資學、行為財務學、環境財經、綠色金融、氣候金融、永續金融",
      research_fields_en: "Investment, Behavioral Finance, Environmental Finance and Economics, Green Finance, Climate Finance, ESG",
      email: "158325@mail.fju.edu.tw",
      phone_zh: "#2678",
      phone_en: "#2678",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 160
    },
    {
      name_zh: "王滄賢(金融國企系專任)",
      name_en: "Tsang-Hsien Wang",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "臺灣科技大學管理研究所博士",
      education_en: "Ph.D in Management, National Taiwan University of Science and Technology",
      research_fields_zh: "消費者行為、行銷管理、創新與產品管理、國際企業管理、品牌管理",
      research_fields_en: "Consumer Behavior、Marketing Management、Innovation and Product Management、International Business Management、Brand Management",
      email: "167167@mail.fju.edu.tw",
      phone_zh: "#3931",
      phone_en: "#3931",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 170
    },
    {
      name_zh: "林佳樺(企業管理系專任)",
      name_en: "Chia-Hua Lin",
      title_zh: "助理教授",
      title_en: "Assistant Professor",
      education_zh: "中正大學心理學系博士",
      education_en: "Ph.D. in Psychology, National Chung Cheng University",
      research_fields_zh: "組織行為、工商心理學",
      research_fields_en: "Organizational Behavior, Industrial and Organizational Psychology",
      email: "167208@mail.fju.edu.tw",
      phone_zh: "#2966",
      phone_en: "#2966",
      website: "",
      image_url: "",
      category: "full",
      sort_order: 180
    },
    {
      name_zh: "王慧美",
      name_en: "Hui-Mei Wang",
      title_zh: "兼任副教授 (前國際經營管理碩士(imMBA)主任)",
      title_en: "Part-time Associate Professor",
      education_zh: "台灣大學國際企業博士",
      education_en: "Ph. D. in International Business, National Taiwan University , Taiwan",
      research_fields_zh: "國際企業、國際行銷",
      research_fields_en: "International Business International Marketing",
      email: "wanghm.tw@gmail.com",
      phone_zh: "",
      phone_en: "",
      website: "",
      image_url: "",
      category: "adjunct",
      sort_order: 200
    }
  ];

  /** Official Fu Jen imMBA teacher photos (same files as teacher.php). */
  var OFFICIAL_PHOTO_BY_EMAIL = {
    "082435@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01753938439.jpg",
    "036665@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01596098393.jpg",
    "065999@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01603245456.jpg",
    "155456@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01662622350.jpg",
    "144629@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01596096150.jpg",
    "129741@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01735200452.jpg",
    "142652@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01662622813.png",
    "151308@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01612145438.jpg",
    "151667@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01646101394.jpg",
    "128144@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01603259236.jpg",
    "156503@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01706580642.png",
    "051266@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01646198858.jpg",
    "145785@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01633500689.jpg",
    "144779@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01652159617.png",
    "152400@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01700462662.jpg",
    "158325@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01700462894.png",
    "167167@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01788763762.png",
    "167208@mail.fju.edu.tw": "https://www.management.fju.edu.tw/upfiles/tw_/menu01788763995.jpg",
    "wanghm.tw@gmail.com": "https://www.management.fju.edu.tw/upfiles/tw_/menu01596097609.jpg"
  };

  DEFAULT_FACULTY.forEach(function (row) {
    var key = String(row.email || "").toLowerCase();
    if (OFFICIAL_PHOTO_BY_EMAIL[key]) row.image_url = OFFICIAL_PHOTO_BY_EMAIL[key];
  });

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

  /**
   * Sync official ZH/EN text by email. Preserves existing image_url.
   * Inserts any missing official faculty.
   */
  async function syncOfficialBilingual() {
    var sb = getClient();
    var existing = await listFaculty();
    var byEmail = {};
    existing.forEach(function (row) {
      if (row.email) byEmail[row.email.toLowerCase()] = row;
    });

    for (var i = 0; i < DEFAULT_FACULTY.length; i++) {
      var seed = DEFAULT_FACULTY[i];
      var key = String(seed.email || "").toLowerCase();
      var prev = byEmail[key];
      var payload = payloadFromInput(seed);
      // Prefer official teacher.php photo URLs; keep custom upload only if seed has none.
      if (seed.image_url) {
        payload.image_url = seed.image_url;
      } else if (prev && prev.image_url) {
        payload.image_url = prev.image_url;
      }

      if (prev) {
        var upd = await sb.from(TABLE).update(payload).eq("id", prev.id);
        if (upd.error) throw upd.error;
      } else {
        var ins = await sb.from(TABLE).insert(payload);
        if (ins.error) throw ins.error;
      }
    }
    return listFaculty();
  }

  async function seedDefaultsIfEmpty() {
    var existing = await listFaculty();
    if (existing.length) {
      var needsZh = existing.some(function (row) { return !row.name_zh; });
      if (needsZh) {
        var synced = await syncOfficialBilingual();
        return { seeded: true, synced: true, count: synced.length, list: synced };
      }
      return { seeded: false, count: existing.length, list: existing };
    }
    var sb = getClient();
    var rows = DEFAULT_FACULTY.map(function (item) { return payloadFromInput(item); });
    var result = await sb.from(TABLE).insert(rows).select();
    if (result.error) throw result.error;
    var list = (result.data || []).map(normalizeRow);
    return { seeded: true, count: list.length, list: list };
  }

  async function replaceWithDefaults() {
    return syncOfficialBilingual();
  }

  function isChair(row) {
    return row && (
      String(row.email || "").toLowerCase() === "082435@mail.fju.edu.tw" ||
      /yi-?ning\s*tu/i.test(String(row.name_en || row.name || "")) ||
      /杜逸寧/.test(String(row.name_zh || ""))
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
    syncOfficialBilingual: syncOfficialBilingual,
    uploadPhoto: uploadPhoto,
    isChair: isChair,
    defaults: DEFAULT_FACULTY,
    photoBucket: PHOTO_BUCKET
  };
})(window);
