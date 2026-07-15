/**
 * Skill catalog (Phase 44 — Personnel Capability Intelligence).
 *
 * THE single source of truth for the seeded skill categories, proficiency
 * levels, and skills. Pure data — no I/O, no React — consumed by the
 * idempotent seeder (scripts/seed_skills.ts via lib/capability/skill_seeder.ts)
 * and by tests. Every entry is bilingual (Thai primary, English secondary —
 * Phase 43 UI guideline); the DB stores both columns and the UI renders the
 * active language.
 *
 * Stable `code`s are the idempotent upsert keys — never renumber or reuse a
 * code. Adding a skill/category later is purely additive (append here + re-run
 * the seeder). `searchableKeywords` widens Commander Search / future AI lookup
 * beyond the display name (e.g. searching "interpreter" finds ภาษาอังกฤษ).
 */

export interface SkillLevelSeed {
  code: string;
  nameTh: string;
  nameEn: string;
  /** 1..7, lowest → highest. */
  rank: number;
}

export interface SkillSeed {
  code: string;
  nameTh: string;
  nameEn: string;
  keywords?: string;
  requiresCertificate?: boolean;
  hasExpiry?: boolean;
}

export interface SkillCategorySeed {
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string;
  skills: SkillSeed[];
}

/** The 7 proficiency levels, lowest → highest. `rank` powers "minimum level ≥ X" search and expert/instructor detection. */
export const SKILL_LEVELS: readonly SkillLevelSeed[] = [
  { code: "BASIC", nameTh: "พื้นฐาน", nameEn: "Basic", rank: 1 },
  { code: "FAIR", nameTh: "พอใช้", nameEn: "Fair", rank: 2 },
  { code: "GOOD", nameTh: "ดี", nameEn: "Good", rank: 3 },
  { code: "VERY_GOOD", nameTh: "ดีมาก", nameEn: "Very Good", rank: 4 },
  { code: "EXCELLENT", nameTh: "ดีเยี่ยม", nameEn: "Excellent", rank: 5 },
  { code: "EXPERT", nameTh: "ผู้เชี่ยวชาญ", nameEn: "Expert", rank: 6 },
  { code: "INSTRUCTOR", nameTh: "ครูฝึก / วิทยากร", nameEn: "Instructor / Trainer", rank: 7 },
] as const;

/** The rank at/above which an officer counts as an "expert" for dashboard/search. */
export const EXPERT_LEVEL_RANK = 6;
/** The rank that marks an "instructor / trainer". */
export const INSTRUCTOR_LEVEL_RANK = 7;

const cert = { requiresCertificate: true } as const;
const certExpiry = { requiresCertificate: true, hasExpiry: true } as const;

export const SKILL_CATALOG: readonly SkillCategorySeed[] = [
  {
    code: "LEGAL",
    nameTh: "ด้านกฎหมายและงานสืบสวน",
    nameEn: "Legal & Investigation",
    icon: "Scale",
    skills: [
      { code: "LEGAL_BARRISTER", nameTh: "เนติบัณฑิต", nameEn: "Barrister-at-law", keywords: "เนติ,barrister,law", ...cert },
      { code: "LEGAL_PHD", nameTh: "ปริญญาเอก นิติศาสตร์", nameEn: "PhD in Law", keywords: "ปริญญาเอก,doctorate,law", ...cert },
      { code: "LEGAL_MASTER", nameTh: "ปริญญาโท นิติศาสตร์", nameEn: "Master of Laws", keywords: "ปริญญาโท,llm,law", ...cert },
      { code: "LEGAL_BACHELOR", nameTh: "ปริญญาตรี นิติศาสตร์", nameEn: "Bachelor of Laws", keywords: "ปริญญาตรี,llb,law", ...cert },
      { code: "LEGAL_LICENSE", nameTh: "ใบอนุญาตว่าความ", nameEn: "Lawyer's License", keywords: "ทนาย,lawyer,license", ...certExpiry },
      { code: "LEGAL_INTERROGATION", nameTh: "งานสอบสวน", nameEn: "Interrogation", keywords: "สอบสวน,interrogation" },
      { code: "LEGAL_CASEFILE", nameTh: "การทำสำนวน", nameEn: "Case File Preparation", keywords: "สำนวน,case file" },
      { code: "LEGAL_INTEL", nameTh: "การสืบสวนหาข่าว", nameEn: "Intelligence Gathering", keywords: "สืบสวน,intelligence" },
      { code: "LEGAL_FINANCIAL", nameTh: "การสืบสวนทางการเงิน", nameEn: "Financial Investigation", keywords: "การเงิน,financial,aml" },
      { code: "LEGAL_FORENSIC_SCI", nameTh: "นิติวิทยาศาสตร์", nameEn: "Forensic Science", keywords: "นิติวิทยาศาสตร์,forensic" },
      { code: "LEGAL_DIGITAL_FORENSICS", nameTh: "การพิสูจน์หลักฐานดิจิทัล", nameEn: "Digital Forensics", keywords: "digital forensics,ดิจิทัล" },
      { code: "LEGAL_CYBER_INVEST", nameTh: "การสืบสวนไซเบอร์", nameEn: "Cyber Investigation", keywords: "cyber,ไซเบอร์" },
      { code: "LEGAL_CSI", nameTh: "การตรวจสถานที่เกิดเหตุ", nameEn: "Crime Scene Investigation", keywords: "csi,crime scene,เกิดเหตุ" },
      { code: "LEGAL_OTHER", nameTh: "อื่น ๆ (ด้านกฎหมาย)", nameEn: "Other (Legal)", keywords: "other" },
    ],
  },
  {
    code: "TECH",
    nameTh: "ด้านเทคโนโลยีและดิจิทัล",
    nameEn: "Technology & Digital",
    icon: "Cpu",
    skills: [
      { code: "TECH_AI", nameTh: "การประยุกต์ใช้ AI", nameEn: "Artificial Intelligence", keywords: "ai,ปัญญาประดิษฐ์,machine learning" },
      { code: "TECH_PROGRAMMING", nameTh: "การเขียนโปรแกรม", nameEn: "Programming", keywords: "programming,coding,เขียนโปรแกรม" },
      { code: "TECH_WEB", nameTh: "พัฒนาเว็บไซต์", nameEn: "Web Development", keywords: "web,เว็บไซต์" },
      { code: "TECH_MOBILE", nameTh: "พัฒนา Mobile App", nameEn: "Mobile App Development", keywords: "mobile,app,แอป" },
      { code: "TECH_DATABASE", nameTh: "ฐานข้อมูล", nameEn: "Database", keywords: "database,sql,ฐานข้อมูล" },
      { code: "TECH_NETWORK", nameTh: "ระบบเครือข่าย", nameEn: "Network", keywords: "network,เครือข่าย" },
      { code: "TECH_CYBERSEC", nameTh: "ความมั่นคงปลอดภัยไซเบอร์", nameEn: "Cyber Security", keywords: "cyber security,ความมั่นคง" },
      { code: "TECH_GIS", nameTh: "ระบบสารสนเทศภูมิศาสตร์ (GIS)", nameEn: "GIS", keywords: "gis,แผนที่,geographic" },
      { code: "TECH_CCTV", nameTh: "ระบบกล้องวงจรปิด (CCTV)", nameEn: "CCTV", keywords: "cctv,กล้องวงจรปิด" },
      { code: "TECH_DRONE", nameTh: "โดรน", nameEn: "Drone", keywords: "drone,โดรน,uav" },
      { code: "TECH_UAV", nameTh: "อากาศยานไร้คนขับ (UAV)", nameEn: "UAV", keywords: "uav,อากาศยานไร้คนขับ" },
      { code: "TECH_RADIO", nameTh: "ระบบวิทยุสื่อสาร", nameEn: "Radio Communication", keywords: "radio,วิทยุ,สื่อสาร" },
      { code: "TECH_SATELLITE", nameTh: "ดาวเทียม", nameEn: "Satellite", keywords: "satellite,ดาวเทียม" },
      { code: "TECH_PHOTO", nameTh: "ถ่ายภาพ", nameEn: "Photography", keywords: "photo,ถ่ายภาพ" },
      { code: "TECH_VIDEO", nameTh: "ถ่ายวิดีโอ", nameEn: "Videography", keywords: "video,ถ่ายวิดีโอ" },
      { code: "TECH_VIDEO_EDIT", nameTh: "ตัดต่อวิดีโอ", nameEn: "Video Editing", keywords: "editing,ตัดต่อ" },
      { code: "TECH_GRAPHIC", nameTh: "ออกแบบกราฟิก", nameEn: "Graphic Design", keywords: "graphic,กราฟิก,design" },
      { code: "TECH_MSOFFICE", nameTh: "Microsoft Office", nameEn: "Microsoft Office", keywords: "office,word,excel" },
      { code: "TECH_EXCEL_ADV", nameTh: "Excel ขั้นสูง", nameEn: "Advanced Excel", keywords: "excel,ขั้นสูง" },
      { code: "TECH_POWERBI", nameTh: "Power BI", nameEn: "Power BI", keywords: "power bi,dashboard,analytics" },
      { code: "TECH_CANVA", nameTh: "Canva", nameEn: "Canva", keywords: "canva,design" },
      { code: "TECH_PHOTOSHOP", nameTh: "Photoshop", nameEn: "Photoshop", keywords: "photoshop,adobe" },
      { code: "TECH_TYPE_TH", nameTh: "พิมพ์ดีดไทย", nameEn: "Thai Typing", keywords: "พิมพ์ดีด,typing,thai" },
      { code: "TECH_TYPE_EN", nameTh: "พิมพ์ดีดอังกฤษ", nameEn: "English Typing", keywords: "พิมพ์ดีด,typing,english" },
      { code: "TECH_OTHER", nameTh: "อื่น ๆ (เทคโนโลยี)", nameEn: "Other (Technology)", keywords: "other" },
    ],
  },
  {
    code: "LANGUAGE",
    nameTh: "ภาษาต่างประเทศ",
    nameEn: "Foreign Languages",
    icon: "Languages",
    skills: [
      { code: "LANG_EN", nameTh: "ภาษาอังกฤษ", nameEn: "English", keywords: "english,อังกฤษ,interpreter,ล่าม" },
      { code: "LANG_ZH", nameTh: "ภาษาจีน", nameEn: "Chinese", keywords: "chinese,จีน,mandarin,ล่าม" },
      { code: "LANG_JA", nameTh: "ภาษาญี่ปุ่น", nameEn: "Japanese", keywords: "japanese,ญี่ปุ่น" },
      { code: "LANG_KO", nameTh: "ภาษาเกาหลี", nameEn: "Korean", keywords: "korean,เกาหลี" },
      { code: "LANG_FR", nameTh: "ภาษาฝรั่งเศส", nameEn: "French", keywords: "french,ฝรั่งเศส" },
      { code: "LANG_DE", nameTh: "ภาษาเยอรมัน", nameEn: "German", keywords: "german,เยอรมัน" },
      { code: "LANG_MY", nameTh: "ภาษาพม่า", nameEn: "Burmese", keywords: "burmese,พม่า,myanmar" },
      { code: "LANG_KM", nameTh: "ภาษาเขมร", nameEn: "Khmer", keywords: "khmer,เขมร,cambodia" },
      { code: "LANG_MS", nameTh: "ภาษามลายู", nameEn: "Malay", keywords: "malay,มลายู" },
      { code: "LANG_AR", nameTh: "ภาษาอาหรับ", nameEn: "Arabic", keywords: "arabic,อาหรับ" },
      { code: "LANG_RU", nameTh: "ภาษารัสเซีย", nameEn: "Russian", keywords: "russian,รัสเซีย" },
      { code: "LANG_OTHER", nameTh: "อื่น ๆ (ภาษา)", nameEn: "Other (Language)", keywords: "other" },
    ],
  },
  {
    code: "TACTICAL",
    nameTh: "ด้านยุทธวิธี",
    nameEn: "Tactical",
    icon: "Crosshair",
    skills: [
      { code: "TAC_SHOOTING", nameTh: "ยิงปืน", nameEn: "Marksmanship", keywords: "shooting,ยิงปืน" },
      { code: "TAC_TACTICAL_SHOOT", nameTh: "การยิงทางยุทธวิธี", nameEn: "Tactical Shooting", keywords: "tactical shooting" },
      { code: "TAC_CQB", nameTh: "การรบระยะประชิด (CQB)", nameEn: "CQB", keywords: "cqb,close quarters" },
      { code: "TAC_SNIPER", nameTh: "พลซุ่มยิง (Sniper)", nameEn: "Sniper", keywords: "sniper,ซุ่มยิง" },
      { code: "TAC_TCCC", nameTh: "การช่วยเหลือผู้บาดเจ็บในสนามรบ (TCCC)", nameEn: "TCCC", keywords: "tccc,combat casualty", ...cert },
      { code: "TAC_COMBAT_MEDIC", nameTh: "เวชกรสนาม (Combat Medic)", nameEn: "Combat Medic", keywords: "combat medic,เวชกร" },
      { code: "TAC_EOD", nameTh: "การเก็บกู้วัตถุระเบิด (EOD)", nameEn: "EOD", keywords: "eod,ระเบิด,bomb", ...cert },
      { code: "TAC_CT", nameTh: "การต่อต้านการก่อการร้าย", nameEn: "Counter Terrorism", keywords: "counter terrorism,ก่อการร้าย" },
      { code: "TAC_ROPE_RESCUE", nameTh: "การกู้ภัยด้วยเชือก", nameEn: "Rope Rescue", keywords: "rope rescue,กู้ภัย" },
      { code: "TAC_WATER_RESCUE", nameTh: "การกู้ภัยทางน้ำ", nameEn: "Water Rescue", keywords: "water rescue,กู้ภัยทางน้ำ" },
      { code: "TAC_K9", nameTh: "สุนัขตำรวจ (K9)", nameEn: "K9 Handler", keywords: "k9,สุนัข,dog" },
      { code: "TAC_INSTRUCTOR", nameTh: "ครูฝึก (ยุทธวิธี)", nameEn: "Instructor (Tactical)", keywords: "instructor,ครูฝึก" },
      { code: "TAC_TRAINER", nameTh: "วิทยากร (ยุทธวิธี)", nameEn: "Trainer (Tactical)", keywords: "trainer,วิทยากร" },
      { code: "TAC_OTHER", nameTh: "อื่น ๆ (ยุทธวิธี)", nameEn: "Other (Tactical)", keywords: "other" },
    ],
  },
  {
    code: "MEDICAL",
    nameTh: "ด้านการแพทย์",
    nameEn: "Medical",
    icon: "HeartPulse",
    skills: [
      { code: "MED_CPR", nameTh: "การช่วยฟื้นคืนชีพ (CPR)", nameEn: "CPR", keywords: "cpr,ช่วยฟื้นคืนชีพ", ...certExpiry },
      { code: "MED_EMT", nameTh: "เวชกรฉุกเฉิน (EMT)", nameEn: "EMT", keywords: "emt,ฉุกเฉิน", ...cert },
      { code: "MED_ALS", nameTh: "การช่วยชีวิตขั้นสูง (ALS)", nameEn: "ALS", keywords: "als,advanced life support", ...cert },
      { code: "MED_BLS", nameTh: "การช่วยชีวิตขั้นพื้นฐาน (BLS)", nameEn: "BLS", keywords: "bls,basic life support", ...cert },
      { code: "MED_COMBAT_MEDIC", nameTh: "เวชกรสนาม", nameEn: "Combat Medic", keywords: "combat medic,เวชกร" },
      { code: "MED_NURSE", nameTh: "พยาบาล", nameEn: "Nurse", keywords: "nurse,พยาบาล", ...cert },
      { code: "MED_DOCTOR", nameTh: "แพทย์", nameEn: "Doctor", keywords: "doctor,แพทย์", ...cert },
      { code: "MED_PHARMACIST", nameTh: "เภสัชกร", nameEn: "Pharmacist", keywords: "pharmacist,เภสัชกร", ...cert },
      { code: "MED_OTHER", nameTh: "อื่น ๆ (การแพทย์)", nameEn: "Other (Medical)", keywords: "other" },
    ],
  },
  {
    code: "AVIATION",
    nameTh: "ด้านอากาศยาน",
    nameEn: "Aviation",
    icon: "Plane",
    skills: [
      { code: "AVI_DRONE_PILOT", nameTh: "นักบินโดรน", nameEn: "Drone Pilot", keywords: "drone pilot,โดรน,นักบิน", ...certExpiry },
      { code: "AVI_FIXED_WING", nameTh: "อากาศยานปีกตรึง", nameEn: "Fixed Wing", keywords: "fixed wing,ปีกตรึง", ...cert },
      { code: "AVI_HELICOPTER", nameTh: "เฮลิคอปเตอร์", nameEn: "Helicopter", keywords: "helicopter,เฮลิคอปเตอร์", ...cert },
      { code: "AVI_UAV_MAPPING", nameTh: "การทำแผนที่ด้วย UAV", nameEn: "UAV Mapping", keywords: "uav mapping,แผนที่" },
      { code: "AVI_THERMAL_DRONE", nameTh: "โดรนตรวจจับความร้อน", nameEn: "Thermal Drone", keywords: "thermal drone,ความร้อน" },
      { code: "AVI_OTHER", nameTh: "อื่น ๆ (อากาศยาน)", nameEn: "Other (Aviation)", keywords: "other" },
    ],
  },
  {
    code: "MECHANIC",
    nameTh: "ด้านช่าง",
    nameEn: "Mechanic & Trades",
    icon: "Wrench",
    skills: [
      { code: "MECH_ENGINE", nameTh: "ช่างยนต์", nameEn: "Mechanic (Engine)", keywords: "ช่างยนต์,mechanic,engine" },
      { code: "MECH_ELECTRICAL", nameTh: "ช่างไฟฟ้า", nameEn: "Electrician", keywords: "ช่างไฟ,electrical,ไฟฟ้า" },
      { code: "MECH_PLUMBING", nameTh: "ช่างประปา", nameEn: "Plumber", keywords: "ช่างประปา,plumbing,ประปา" },
      { code: "MECH_WELDING", nameTh: "ช่างเชื่อม", nameEn: "Welder", keywords: "ช่างเชื่อม,welding,เชื่อม" },
      { code: "MECH_CARPENTRY", nameTh: "ช่างไม้", nameEn: "Carpenter", keywords: "ช่างไม้,carpentry,ไม้" },
      { code: "MECH_ENGINE_REPAIR", nameTh: "ซ่อมเครื่องยนต์", nameEn: "Engine Repair", keywords: "ซ่อมเครื่องยนต์,repair" },
      { code: "MECH_OTHER", nameTh: "อื่น ๆ (ช่าง)", nameEn: "Other (Trades)", keywords: "other" },
    ],
  },
  {
    code: "SPORTS",
    nameTh: "กีฬาและสมรรถภาพ",
    nameEn: "Sports & Fitness",
    icon: "Dumbbell",
    skills: [
      { code: "SPORT_FOOTBALL", nameTh: "ฟุตบอล", nameEn: "Football", keywords: "football,ฟุตบอล,soccer" },
      { code: "SPORT_FUTSAL", nameTh: "ฟุตซอล", nameEn: "Futsal", keywords: "futsal,ฟุตซอล" },
      { code: "SPORT_VOLLEYBALL", nameTh: "วอลเลย์บอล", nameEn: "Volleyball", keywords: "volleyball,วอลเลย์" },
      { code: "SPORT_TAKRAW", nameTh: "ตะกร้อ", nameEn: "Sepak Takraw", keywords: "takraw,ตะกร้อ" },
      { code: "SPORT_PETANQUE", nameTh: "เปตอง", nameEn: "Petanque", keywords: "petanque,เปตอง" },
      { code: "SPORT_GOLF", nameTh: "กอล์ฟ", nameEn: "Golf", keywords: "golf,กอล์ฟ" },
      { code: "SPORT_SHOOTING", nameTh: "ยิงปืน (กีฬา)", nameEn: "Sport Shooting", keywords: "shooting,ยิงปืน" },
      { code: "SPORT_MARATHON", nameTh: "วิ่งมาราธอน", nameEn: "Marathon", keywords: "marathon,มาราธอน,running" },
      { code: "SPORT_TRAIL", nameTh: "วิ่งเทรล", nameEn: "Trail Running", keywords: "trail,เทรล" },
      { code: "SPORT_SWIMMING", nameTh: "ว่ายน้ำ", nameEn: "Swimming", keywords: "swimming,ว่ายน้ำ" },
      { code: "SPORT_TRIATHLON", nameTh: "ไตรกีฬา", nameEn: "Triathlon", keywords: "triathlon,ไตรกีฬา" },
      { code: "SPORT_HYROX", nameTh: "HYROX", nameEn: "HYROX", keywords: "hyrox,fitness" },
      { code: "SPORT_CROSSFIT", nameTh: "CrossFit", nameEn: "CrossFit", keywords: "crossfit,fitness" },
      { code: "SPORT_BADMINTON", nameTh: "แบดมินตัน", nameEn: "Badminton", keywords: "badminton,แบดมินตัน" },
      { code: "SPORT_OTHER", nameTh: "อื่น ๆ (กีฬา)", nameEn: "Other (Sports)", keywords: "other" },
    ],
  },
  {
    code: "MEDIA",
    nameTh: "สื่อและประชาสัมพันธ์",
    nameEn: "Media & PR",
    icon: "Megaphone",
    skills: [
      { code: "MEDIA_MC", nameTh: "พิธีกร", nameEn: "Master of Ceremonies", keywords: "mc,พิธีกร,host" },
      { code: "MEDIA_PR", nameTh: "ประชาสัมพันธ์", nameEn: "Public Relations", keywords: "pr,ประชาสัมพันธ์" },
      { code: "MEDIA_NEWS", nameTh: "เขียนข่าว", nameEn: "News Writing", keywords: "news,เขียนข่าว" },
      { code: "MEDIA_PHOTO", nameTh: "ถ่ายภาพ", nameEn: "Photography", keywords: "photo,ถ่ายภาพ" },
      { code: "MEDIA_VIDEO", nameTh: "ถ่ายวิดีโอ", nameEn: "Videography", keywords: "video,ถ่ายวิดีโอ" },
      { code: "MEDIA_GRAPHIC", nameTh: "ออกแบบกราฟิก", nameEn: "Graphic Design", keywords: "graphic,กราฟิก" },
      { code: "MEDIA_SOCIAL", nameTh: "โซเชียลมีเดีย", nameEn: "Social Media", keywords: "social media,โซเชียล" },
      { code: "MEDIA_LIVE", nameTh: "ถ่ายทอดสด", nameEn: "Live Streaming", keywords: "live,ถ่ายทอดสด,streaming" },
      { code: "MEDIA_OTHER", nameTh: "อื่น ๆ (สื่อ)", nameEn: "Other (Media)", keywords: "other" },
    ],
  },
  {
    code: "MUSIC",
    nameTh: "ดนตรี",
    nameEn: "Music",
    icon: "Music",
    skills: [
      { code: "MUSIC_BAND", nameTh: "ดุริยางค์", nameEn: "Marching Band", keywords: "band,ดุริยางค์" },
      { code: "MUSIC_GUITAR", nameTh: "กีตาร์", nameEn: "Guitar", keywords: "guitar,กีตาร์" },
      { code: "MUSIC_PIANO", nameTh: "เปียโน", nameEn: "Piano", keywords: "piano,เปียโน" },
      { code: "MUSIC_DRUMS", nameTh: "กลอง", nameEn: "Drums", keywords: "drums,กลอง" },
      { code: "MUSIC_WIND", nameTh: "เครื่องเป่า", nameEn: "Wind Instrument", keywords: "wind,เครื่องเป่า" },
      { code: "MUSIC_SINGER", nameTh: "นักร้อง", nameEn: "Singer", keywords: "singer,นักร้อง,vocal" },
      { code: "MUSIC_OTHER", nameTh: "อื่น ๆ (ดนตรี)", nameEn: "Other (Music)", keywords: "other" },
    ],
  },
  {
    code: "OTHER",
    nameTh: "อื่น ๆ",
    nameEn: "Other",
    icon: "MoreHorizontal",
    skills: [
      { code: "OTHER_GENERAL", nameTh: "อื่น ๆ", nameEn: "Other", keywords: "other,อื่นๆ" },
    ],
  },
] as const;

/** Total seeded skill count (for tests + the seeder summary). */
export const TOTAL_SKILL_COUNT = SKILL_CATALOG.reduce((sum, c) => sum + c.skills.length, 0);
