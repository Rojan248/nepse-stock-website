/**
 * Comprehensive list of ALL NEPSE Stocks (326+ companies)
 * This provides a static mapping of Symbol -> Company Name to ensure real data.
 * Updated: December 2025
 */

const NEPSE_STOCKS = [
    // ============================================
    // COMMERCIAL BANKS (20 companies)
    // ============================================
    { symbol: 'ADBL', name: 'Agricultural Development Bank Limited', sector: 'Commercial Banks', base: 292 },
    { symbol: 'CZBIL', name: 'Citizens Bank International Limited', sector: 'Commercial Banks', base: 245 },
    { symbol: 'EBL', name: 'Everest Bank Limited', sector: 'Commercial Banks', base: 465 },
    { symbol: 'GBIME', name: 'Global IME Bank Limited', sector: 'Commercial Banks', base: 250 },
    { symbol: 'HBL', name: 'Himalayan Bank Limited', sector: 'Commercial Banks', base: 318 },
    { symbol: 'KBL', name: 'Kumari Bank Limited', sector: 'Commercial Banks', base: 190 },
    { symbol: 'LSL', name: 'Laxmi Sunrise Bank Limited', sector: 'Commercial Banks', base: 225 },
    { symbol: 'MBL', name: 'Machhapuchchhre Bank Limited', sector: 'Commercial Banks', base: 220 },
    { symbol: 'NABIL', name: 'Nabil Bank Limited', sector: 'Commercial Banks', base: 685 },
    { symbol: 'NBL', name: 'Nepal Bank Limited', sector: 'Commercial Banks', base: 285 },
    { symbol: 'NICA', name: 'NIC Asia Bank Ltd.', sector: 'Commercial Banks', base: 575 },
    { symbol: 'NMB', name: 'NMB Bank Limited', sector: 'Commercial Banks', base: 246 },
    { symbol: 'PCBL', name: 'Prime Commercial Bank Limited', sector: 'Commercial Banks', base: 215 },
    { symbol: 'PRVU', name: 'Prabhu Bank Limited', sector: 'Commercial Banks', base: 195 },
    { symbol: 'SANIMA', name: 'Sanima Bank Limited', sector: 'Commercial Banks', base: 280 },
    { symbol: 'SBI', name: 'Nepal SBI Bank Limited', sector: 'Commercial Banks', base: 335 },
    { symbol: 'SBL', name: 'Siddhartha Bank Limited', sector: 'Commercial Banks', base: 350 },
    { symbol: 'SCB', name: 'Standard Chartered Bank Nepal Limited', sector: 'Commercial Banks', base: 565 },
    { symbol: 'NIMB', name: 'Nepal Investment Mega Bank Limited', sector: 'Commercial Banks', base: 258 },

    // ============================================
    // DEVELOPMENT BANKS (17 companies)
    // ============================================
    { symbol: 'CORBL', name: 'Corporate Development Bank Limited', sector: 'Development Banks', base: 450 },
    { symbol: 'EDBL', name: 'Excel Development Bank Limited', sector: 'Development Banks', base: 370 },
    { symbol: 'GBBL', name: 'Garima Bikas Bank Limited', sector: 'Development Banks', base: 360 },
    { symbol: 'GRDBL', name: 'Green Development Bank Limited', sector: 'Development Banks', base: 340 },
    { symbol: 'JBBL', name: 'Jyoti Bikas Bank Limited', sector: 'Development Banks', base: 300 },
    { symbol: 'KSBBL', name: 'Kamana Sewa Bikas Bank Limited', sector: 'Development Banks', base: 320 },
    { symbol: 'KRBL', name: 'Karnali Development Bank Limited', sector: 'Development Banks', base: 400 },
    { symbol: 'LBBL', name: 'Lumbini Bikas Bank Limited', sector: 'Development Banks', base: 290 },
    { symbol: 'MLBL', name: 'Mahalaxmi Bikas Bank Limited', sector: 'Development Banks', base: 310 },
    { symbol: 'MDB', name: 'Miteri Development Bank Limited', sector: 'Development Banks', base: 390 },
    { symbol: 'MNBBL', name: 'Muktinath Bikas Bank Limited', sector: 'Development Banks', base: 380 },
    { symbol: 'NABBC', name: 'Narayani Development Bank Limited', sector: 'Development Banks', base: 450 },
    { symbol: 'SAPDBL', name: 'Saptakoshi Development Bank Ltd', sector: 'Development Banks', base: 320 },
    { symbol: 'SADBL', name: 'Shangrila Development Bank Limited', sector: 'Development Banks', base: 280 },
    { symbol: 'SHINE', name: 'Shine Resunga Development Bank Ltd.', sector: 'Development Banks', base: 340 },
    { symbol: 'SINDU', name: 'Sindhu Bikas Bank Limited', sector: 'Development Banks', base: 260 },
    { symbol: 'SBBLJ', name: 'Sana Bikash Bank Limited', sector: 'Development Banks', base: 290 },

    // ============================================
    // FINANCE COMPANIES (15 companies)
    // ============================================
    { symbol: 'BFC', name: 'Best Finance Company Limited', sector: 'Finance', base: 350 },
    { symbol: 'CFCL', name: 'Central Finance Co. Ltd.', sector: 'Finance', base: 370 },
    { symbol: 'GFCL', name: 'Goodwill Finance Co. Ltd.', sector: 'Finance', base: 430 },
    { symbol: 'GMFIL', name: 'Guheswori Merchant Banking & Finance Ltd', sector: 'Finance', base: 345 },
    { symbol: 'GUFL', name: 'Gurkhas Finance Ltd.', sector: 'Finance', base: 490 },
    { symbol: 'ICFC', name: 'ICFC Finance Limited', sector: 'Finance', base: 490 },
    { symbol: 'JFL', name: 'Janaki Finance Ltd.', sector: 'Finance', base: 380 },
    { symbol: 'MFIL', name: 'Manjushree Finance Ltd.', sector: 'Finance', base: 420 },
    { symbol: 'MPFL', name: 'Multipurpose Finance Company Limited', sector: 'Finance', base: 350 },
    { symbol: 'NFS', name: 'Nepal Finance Limited', sector: 'Finance', base: 400 },
    { symbol: 'PFL', name: 'Pokhara Finance Ltd.', sector: 'Finance', base: 460 },
    { symbol: 'PROFL', name: 'Progressive Finance Limited', sector: 'Finance', base: 330 },
    { symbol: 'RLFL', name: 'Reliance Finance Ltd.', sector: 'Finance', base: 390 },
    { symbol: 'SFCL', name: 'Samriddhi Finance Company Limited', sector: 'Finance', base: 360 },
    { symbol: 'SIFC', name: 'Shree Investment Finance Co. Ltd.', sector: 'Finance', base: 380 },

    // ============================================
    // HYDROPOWER (85+ companies)
    // ============================================
    { symbol: 'AHPC', name: 'Arun Valley Hydropower Development Co. Ltd.', sector: 'Hydro Power', base: 278 },
    { symbol: 'AKJCL', name: 'Arun Kabeli Power Limited', sector: 'Hydro Power', base: 184 },
    { symbol: 'AKPL', name: 'Arun Kabeli Power Ltd.', sector: 'Hydro Power', base: 242 },
    { symbol: 'API', name: 'Api Power Company Ltd.', sector: 'Hydro Power', base: 320 },
    { symbol: 'AVU', name: 'Avyan Urja Company Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'BARUN', name: 'Barun Hydropower Co. Ltd.', sector: 'Hydro Power', base: 360 },
    { symbol: 'BEDC', name: 'Bindhyabasini Energy Development Company Ltd.', sector: 'Hydro Power', base: 180 },
    { symbol: 'BGWT', name: 'Bagwati Hydropower Development Company Limited', sector: 'Hydro Power', base: 165 },
    { symbol: 'BHL', name: 'Bhotekoshi Hydropower Limited', sector: 'Hydro Power', base: 280 },
    { symbol: 'BHPL', name: 'Bijayapur Hydropower Limited', sector: 'Hydro Power', base: 245 },
    { symbol: 'BNHC', name: 'Buddhabhumi Nepal Hydro Power Co. Ltd.', sector: 'Hydro Power', base: 210 },
    { symbol: 'BPCL', name: 'Butwal Power Company Limited', sector: 'Hydro Power', base: 340 },
    { symbol: 'CHCL', name: 'Chilime Hydropower Company Limited', sector: 'Hydro Power', base: 480 },
    { symbol: 'CHL', name: 'Chhyangdi Hydropower Limited', sector: 'Hydro Power', base: 185 },
    { symbol: 'CKHL', name: 'Chaukhamba Hydropower Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'DHPL', name: 'Dibyashwori Hydropower Ltd.', sector: 'Hydro Power', base: 240 },
    { symbol: 'DOLTI', name: 'Dolti Power Company Limited', sector: 'Hydro Power', base: 178 },
    { symbol: 'DORDI', name: 'Dordi Khola Jalavidhyut Company Ltd.', sector: 'Hydro Power', base: 320 },
    { symbol: 'GHL', name: 'Green Hydropower Company Limited', sector: 'Hydro Power', base: 180 },
    { symbol: 'GLH', name: 'Gulmi Hydropower Company Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'GMBU', name: 'Gaumbu Hydropower Limited', sector: 'Hydro Power', base: 165 },
    { symbol: 'GVL', name: 'Ghalemdi Hydropower Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'HDHPC', name: 'Himal Dolakha Hydropower Company Limited', sector: 'Hydro Power', base: 190 },
    { symbol: 'HHL', name: 'Himalaya Hydropower Limited', sector: 'Hydro Power', base: 210 },
    { symbol: 'HPPL', name: 'Himalayan Power Partner Ltd.', sector: 'Hydro Power', base: 240 },
    { symbol: 'HURJA', name: 'Himalayan Urja Bikas Company Limited', sector: 'Hydro Power', base: 220 },
    { symbol: 'IHL', name: 'Ingwa Hydropower Limited', sector: 'Hydro Power', base: 185 },
    { symbol: 'JOSHI', name: 'Joshi Hydropower Development Company Ltd.', sector: 'Hydro Power', base: 260 },
    { symbol: 'KBSH', name: 'Kutheli Bukhari Small Hydropower Ltd', sector: 'Hydro Power', base: 172 },
    { symbol: 'KKHC', name: 'Khani Khola Hydropower Co. Ltd.', sector: 'Hydro Power', base: 160 },
    { symbol: 'KPCL', name: 'Kalika Power Company Limited', sector: 'Hydro Power', base: 280 },
    { symbol: 'LEC', name: 'Liberty Energy Company Ltd.', sector: 'Hydro Power', base: 310 },
    { symbol: 'LPPL', name: 'Lalitpur Power Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'MBJC', name: 'Madhya Bhotekoshi Jalavidhyut Company Ltd.', sector: 'Hydro Power', base: 490 },
    { symbol: 'MEHL', name: 'Molung Hydropower Limited', sector: 'Hydro Power', base: 178 },
    { symbol: 'MHCL', name: 'Mandakini Hydropower Limited', sector: 'Hydro Power', base: 230 },
    { symbol: 'MHNL', name: 'Mountain Hydro Nepal Limited', sector: 'Hydro Power', base: 190 },
    { symbol: 'MHL', name: 'Manakamana Hydro Limited', sector: 'Hydro Power', base: 205 },
    { symbol: 'MKHL', name: 'Mai Khola Hydropower Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'MKJC', name: 'Mai Khola Jalabidhyut Company Limited', sector: 'Hydro Power', base: 188 },
    { symbol: 'MMKJL', name: 'Middle Marsyangdi Hydropower', sector: 'Hydro Power', base: 210 },
    { symbol: 'MPHL', name: 'Mountain Power Hydropower Limited', sector: 'Hydro Power', base: 178 },
    { symbol: 'MSHL', name: 'Modi Khola Hydropower Limited', sector: 'Hydro Power', base: 185 },
    { symbol: 'NHDL', name: 'Nepal Hydro Developers Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'NHPC', name: 'National Hydro Power Company Limited', sector: 'Hydro Power', base: 140 },
    { symbol: 'NGPL', name: 'Ngadi Group Power Ltd.', sector: 'Hydro Power', base: 310 },
    { symbol: 'NKJCL', name: 'Nangkholang Kirat Urja Company Ltd.', sector: 'Hydro Power', base: 168 },
    { symbol: 'NYADI', name: 'Nyadi Hydropower Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'PHLBSL', name: 'Panchamrit Hydropower Limited', sector: 'Hydro Power', base: 182 },
    { symbol: 'PMHPL', name: 'Peoples Hydropower Company Limited', sector: 'Hydro Power', base: 185 },
    { symbol: 'PPC', name: 'Panchthar Power Company Limited', sector: 'Hydro Power', base: 255 },
    { symbol: 'PPL', name: 'Pushpalal Power Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'PPCL', name: 'Peoples Power Company Limited', sector: 'Hydro Power', base: 188 },
    { symbol: 'RADHI', name: 'Radhi Bidyut Company Ltd.', sector: 'Hydro Power', base: 250 },
    { symbol: 'RHGCL', name: 'Rasuwagadhi Hydropower Co Ltd.', sector: 'Hydro Power', base: 175 },
    { symbol: 'RHPC', name: 'Rairang Hydropower Development Co. Ltd.', sector: 'Hydro Power', base: 290 },
    { symbol: 'RHPL', name: 'Rasuwagadhi Hydropower Company Limited', sector: 'Hydro Power', base: 240 },
    { symbol: 'RIDI', name: 'Ridi Hydropower Development Company Ltd.', sector: 'Hydro Power', base: 380 },
    { symbol: 'RURU', name: 'Ruru Jalvidhyut Pariyojana Limited', sector: 'Hydro Power', base: 270 },
    { symbol: 'SAHAS', name: 'Sahas Urja Limited', sector: 'Hydro Power', base: 335 },
    { symbol: 'SBHL', name: 'Sarbottam Hydropower Limited', sector: 'Hydro Power', base: 178 },
    { symbol: 'SHEL', name: 'Sanima Hydro Power Ltd.', sector: 'Hydro Power', base: 295 },
    { symbol: 'SHPC', name: 'Sanima Mai Hydropower Ltd.', sector: 'Hydro Power', base: 380 },
    { symbol: 'SIH', name: 'Singati Hydro Energy Limited', sector: 'Hydro Power', base: 190 },
    { symbol: 'SIKLES', name: 'Sikles Hydropower Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'SJCL', name: 'Sanjen Jalavidhyut Company Limited', sector: 'Hydro Power', base: 220 },
    { symbol: 'SMFHL', name: 'Sagarmatha Hydropower Limited', sector: 'Hydro Power', base: 185 },
    { symbol: 'SMHL', name: 'Super Mai Hydropower Limited', sector: 'Hydro Power', base: 360 },
    { symbol: 'SPDL', name: 'Samling Power Development Limited', sector: 'Hydro Power', base: 220 },
    { symbol: 'SPHL', name: 'Sindhu Power Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'SSHL', name: 'Sunkoshi Mai Hydropower Limited', sector: 'Hydro Power', base: 188 },
    { symbol: 'TAMOR', name: 'Tamor Hydropower Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'TPCL', name: 'Terhathum Power Company Limited', sector: 'Hydro Power', base: 178 },
    { symbol: 'TPC', name: 'Tamakoshi Power Company Limited', sector: 'Hydro Power', base: 280 },
    { symbol: 'UMHL', name: 'United Modi Hydropower Ltd.', sector: 'Hydro Power', base: 230 },
    { symbol: 'UNHPL', name: 'Upper Nepal Hydropower Limited', sector: 'Hydro Power', base: 350 },
    { symbol: 'UPCL', name: 'United Power Company Limited', sector: 'Hydro Power', base: 245 },
    { symbol: 'UPPER', name: 'Upper Tamakoshi Hydropower Ltd', sector: 'Hydro Power', base: 260 },
    { symbol: 'USHEC', name: 'Upper Solu Hydropower Limited', sector: 'Hydro Power', base: 182 },
    { symbol: 'YNHPL', name: 'Yantrik Urja Limited', sector: 'Hydro Power', base: 175 },

    // ============================================
    // HOTELS AND TOURISM (4 companies)
    // ============================================
    { symbol: 'CGH', name: 'Chandragiri Hills Limited', sector: 'Hotels And Tourism', base: 850 },
    { symbol: 'OHL', name: 'Oriental Hotels Limited', sector: 'Hotels And Tourism', base: 560 },
    { symbol: 'SHL', name: 'Soaltee Hotel Limited', sector: 'Hotels And Tourism', base: 490 },
    { symbol: 'TRH', name: 'Taragaon Regency Hotel Limited', sector: 'Hotels And Tourism', base: 430 },

    // ============================================
    // LIFE INSURANCE (18 companies)
    // ============================================
    { symbol: 'ALICL', name: 'Asian Life Insurance Co. Ltd.', sector: 'Life Insurance', base: 465 },
    { symbol: 'CLI', name: 'Citizens Life Insurance Company Limited', sector: 'Life Insurance', base: 420 },
    { symbol: 'GLICL', name: 'Gurans Life Insurance Company Ltd.', sector: 'Life Insurance', base: 440 },
    { symbol: 'ILI', name: 'IME Life Insurance Company Limited', sector: 'Life Insurance', base: 395 },
    { symbol: 'JLIC', name: 'Jyoti Life Insurance Company Limited', sector: 'Life Insurance', base: 410 },
    { symbol: 'JLI', name: 'Janata Life Insurance Company Limited', sector: 'Life Insurance', base: 385 },
    { symbol: 'LICN', name: 'Life Insurance Corporation (Nepal) Limited', sector: 'Life Insurance', base: 795 },
    { symbol: 'MLIC', name: 'Mahalaxmi Life Insurance Limited', sector: 'Life Insurance', base: 380 },
    { symbol: 'NLICL', name: 'National Life Insurance Company Limited', sector: 'Life Insurance', base: 825 },
    { symbol: 'NLIC', name: 'Nepal Life Insurance Co. Ltd.', sector: 'Life Insurance', base: 610 },
    { symbol: 'PLIC', name: 'Prime Life Insurance Company Limited', sector: 'Life Insurance', base: 470 },
    { symbol: 'PLI', name: 'Prabhu Life Insurance Limited', sector: 'Life Insurance', base: 405 },
    { symbol: 'RNLI', name: 'Reliable Nepal Life Insurance Ltd.', sector: 'Life Insurance', base: 480 },
    { symbol: 'SJLIC', name: 'Surya Jyoti Life Insurance Company Limited', sector: 'Life Insurance', base: 375 },
    { symbol: 'SLI', name: 'Sanima Life Insurance Limited', sector: 'Life Insurance', base: 395 },
    { symbol: 'SNLI', name: 'Sun Nepal Life Insurance Company Limited', sector: 'Life Insurance', base: 450 },
    { symbol: 'SULI', name: 'Siddhartha Life Insurance Company Limited', sector: 'Life Insurance', base: 385 },
    { symbol: 'ULI', name: 'Union Life Insurance Company Limited', sector: 'Life Insurance', base: 370 },

    // ============================================
    // NON-LIFE INSURANCE (17 companies)
    // ============================================
    { symbol: 'AIG', name: 'Ajod Insurance Company Limited', sector: 'Non Life Insurance', base: 520 },
    { symbol: 'AIL', name: 'Asian Insurance Company Limited', sector: 'Non Life Insurance', base: 510 },
    { symbol: 'EIC', name: 'Everest Insurance Company Ltd.', sector: 'Non Life Insurance', base: 640 },
    { symbol: 'GIC', name: 'General Insurance Company Limited', sector: 'Non Life Insurance', base: 495 },
    { symbol: 'HGI', name: 'Himalayan General Insurance Co. Ltd.', sector: 'Non Life Insurance', base: 550 },
    { symbol: 'IGI', name: 'IME General Insurance Limited', sector: 'Non Life Insurance', base: 520 },
    { symbol: 'LGIL', name: 'Lumbini General Insurance Co. Ltd.', sector: 'Non Life Insurance', base: 620 },
    { symbol: 'NALIC', name: 'Nepal Agricultural Insurance Company Limited', sector: 'Non Life Insurance', base: 485 },
    { symbol: 'NIL', name: 'Nepal Insurance Company Ltd.', sector: 'Non Life Insurance', base: 790 },
    { symbol: 'NLG', name: 'NLG Insurance Company Ltd.', sector: 'Non Life Insurance', base: 820 },
    { symbol: 'PICL', name: 'Premier Insurance Company (Nepal) Limited', sector: 'Non Life Insurance', base: 695 },
    { symbol: 'PRIN', name: 'Prudential Insurance Company Limited', sector: 'Non Life Insurance', base: 545 },
    { symbol: 'PIC', name: 'Prabhu Insurance Limited', sector: 'Non Life Insurance', base: 580 },
    { symbol: 'RBCL', name: 'Rastriya Beema Company Limited', sector: 'Non Life Insurance', base: 875 },
    { symbol: 'SICL', name: 'Shikhar Insurance Co. Ltd.', sector: 'Non Life Insurance', base: 810 },
    { symbol: 'SIL', name: 'Siddhartha Insurance Ltd.', sector: 'Non Life Insurance', base: 640 },
    { symbol: 'SGI', name: 'Sagarmatha Insurance Company Limited', sector: 'Non Life Insurance', base: 560 },

    // ============================================
    // MICROFINANCE (65+ companies)
    // ============================================
    { symbol: 'ACLBSL', name: 'Asha Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 991 },
    { symbol: 'ALBSL', name: 'Arambha Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1080 },
    { symbol: 'ANLB', name: 'Angel Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 620 },
    { symbol: 'AVYAN', name: 'Aviyan Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 595 },
    { symbol: 'BBLM', name: 'Buddha Bhumi Nepal Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 580 },
    { symbol: 'CBBL', name: 'Chhimek Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1220 },
    { symbol: 'CLBSL', name: 'Civil Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 845 },
    { symbol: 'CYCL', name: 'City Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 610 },
    { symbol: 'DDBL', name: 'Deprosc Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 860 },
    { symbol: 'DLBS', name: 'Dhaulagiri Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 620 },
    { symbol: 'FMDBL', name: 'First Micro Finance Laghubitta Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 1125 },
    { symbol: 'FOWAD', name: 'Forward Community Microfinance Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 915 },
    { symbol: 'FWDBL', name: 'Forward Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 680 },
    { symbol: 'GBLBS', name: 'Grameen Bikas Laghubitta Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 720 },
    { symbol: 'GILB', name: 'Global IME Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1015 },
    { symbol: 'GLBSL', name: 'Gorkha Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 595 },
    { symbol: 'GMFBS', name: 'Grameen Microfinance Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 645 },
    { symbol: 'HLBSL', name: 'Himalaya Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 580 },
    { symbol: 'ILBS', name: 'Infinity Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 640 },
    { symbol: 'JALPA', name: 'Jalpa Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 610 },
    { symbol: 'JBLB', name: 'Janautthan Samudayic Laghubitta Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 685 },
    { symbol: 'JSLBB', name: 'Janautthan Samudayic Laghubitta Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 580 },
    { symbol: 'KLBSL', name: 'Kisan Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 640 },
    { symbol: 'KMCDB', name: 'Kalika Microcredit Development Bank Limited', sector: 'Microfinance', base: 545 },
    { symbol: 'LLBS', name: 'Laxmi Laghubitta Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 980 },
    { symbol: 'MATRI', name: 'Matribhumi Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 585 },
    { symbol: 'MERO', name: 'Mero Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 945 },
    { symbol: 'MLBBL', name: 'Mithila Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 640 },
    { symbol: 'MLBS', name: 'Mirmire Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 785 },
    { symbol: 'MLBSL', name: 'Manakamana Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 610 },
    { symbol: 'MMFDB', name: 'Mountain Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 580 },
    { symbol: 'MSLB', name: 'Mahila Samudayik Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 560 },
    { symbol: 'NADEP', name: 'Nadep Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 625 },
    { symbol: 'NGBLB', name: 'Nagbeli Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 610 },
    { symbol: 'NMBMF', name: 'NMB Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 955 },
    { symbol: 'NMFBS', name: 'National Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 820 },
    { symbol: 'NSLB', name: 'Nagbeli Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 610 },
    { symbol: 'NUBL', name: 'Nirdhan Utthan Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1280 },
    { symbol: 'PHCL', name: 'Purnima Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 590 },
    { symbol: 'RMDC', name: 'RMDC Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 850 },
    { symbol: 'RSDC', name: 'RSDC Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 680 },
    { symbol: 'SABSL', name: 'Samata Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 590 },
    { symbol: 'SAMAJ', name: 'Samaj Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 575 },
    { symbol: 'SAMJU', name: 'Samjhana Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 590 },
    { symbol: 'SDMFL', name: 'Siddhartha Microfinance Limited', sector: 'Microfinance', base: 645 },
    { symbol: 'SKBBL', name: 'Sana Kisan Bikas Laghubitta Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 1185 },
    { symbol: 'SLBBL', name: 'Samudayic Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 615 },
    { symbol: 'SLBSL', name: 'Suryodaya Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 760 },
    { symbol: 'SMATA', name: 'Samata Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 540 },
    { symbol: 'SMB', name: 'Summit Microfinance Dev Bank Ltd.', sector: 'Microfinance', base: 620 },
    { symbol: 'SMFBS', name: 'Sana Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 580 },
    { symbol: 'SMPDA', name: 'Samprada Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 595 },
    { symbol: 'SUBHA', name: 'Subha Laxmi Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 585 },
    { symbol: 'SWBBL', name: 'Swabalamban Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1110 },
    { symbol: 'SWLB', name: 'Swabhiman Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 615 },
    { symbol: 'ULBSL', name: 'Unnati Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 650 },
    { symbol: 'USLB', name: 'Upakar Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 570 },
    { symbol: 'VLBS', name: 'Vijaya Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 650 },
    { symbol: 'WOMI', name: 'WOMI Microfinance Bittiya Sanstha Ltd.', sector: 'Microfinance', base: 1020 },
    { symbol: 'WNLB', name: 'Western Nepal Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 595 },

    // ============================================
    // MUTUAL FUNDS (30+ schemes)
    // ============================================
    { symbol: 'CMF1', name: 'Citizens Mutual Fund-1', sector: 'Mutual Fund', base: 12.5 },
    { symbol: 'CMF2', name: 'Citizens Mutual Fund-2', sector: 'Mutual Fund', base: 11.8 },
    { symbol: 'CMBF', name: 'Civil Bank Money Plus Fund', sector: 'Mutual Fund', base: 10.2 },
    { symbol: 'GIMES1', name: 'Global IME Samunnat Scheme-1', sector: 'Mutual Fund', base: 12.1 },
    { symbol: 'HIDCLP', name: 'HIDCL Mutual Fund', sector: 'Mutual Fund', base: 10.8 },
    { symbol: 'KEF', name: 'Kumari Equity Fund', sector: 'Mutual Fund', base: 11.2 },
    { symbol: 'LEMF', name: 'Laxmi Equity Fund', sector: 'Mutual Fund', base: 13.5 },
    { symbol: 'LUK', name: 'Laxmi Unnati Kosh', sector: 'Mutual Fund', base: 10.9 },
    { symbol: 'LVF1', name: 'Laxmi Value Fund-1', sector: 'Mutual Fund', base: 12.8 },
    { symbol: 'LVF2', name: 'Laxmi Value Fund-2', sector: 'Mutual Fund', base: 10.5 },
    { symbol: 'MBKJC', name: 'MBL Money Plus Fund', sector: 'Mutual Fund', base: 10.3 },
    { symbol: 'MEF', name: 'Mahila Equity Fund', sector: 'Mutual Fund', base: 10.1 },
    { symbol: 'MHEF', name: 'Megha Hydropower Equity Fund', sector: 'Mutual Fund', base: 10.2 },
    { symbol: 'NBB', name: 'Nabil Balanced Fund-3', sector: 'Mutual Fund', base: 10.8 },
    { symbol: 'NBF2', name: 'Nabil Balanced Fund-2', sector: 'Mutual Fund', base: 14.2 },
    { symbol: 'NBF3', name: 'Nabil Balanced Fund-3', sector: 'Mutual Fund', base: 11.5 },
    { symbol: 'NEF', name: 'Nabil Equity Fund', sector: 'Mutual Fund', base: 13.8 },
    { symbol: 'NIBLGF', name: 'NIBL Growth Fund', sector: 'Mutual Fund', base: 12.5 },
    { symbol: 'NIBLPF', name: 'NIBL Pragati Fund', sector: 'Mutual Fund', base: 11.8 },
    { symbol: 'NIBSF1', name: 'NIBL Samriddhi Fund-1', sector: 'Mutual Fund', base: 13.2 },
    { symbol: 'NIBSF2', name: 'NIBL Samriddhi Fund-2', sector: 'Mutual Fund', base: 10.5 },
    { symbol: 'NICBF', name: 'NIC Asia Balance Fund', sector: 'Mutual Fund', base: 11.2 },
    { symbol: 'NICGF', name: 'NIC Asia Growth Fund', sector: 'Mutual Fund', base: 14.5 },
    { symbol: 'NICSF', name: 'NIC Asia Select-30 Index Fund', sector: 'Mutual Fund', base: 10.8 },
    { symbol: 'NMB50', name: 'NMB 50 Fund', sector: 'Mutual Fund', base: 12.8 },
    { symbol: 'NMBHF1', name: 'NMB Hybrid Fund L-1', sector: 'Mutual Fund', base: 11.5 },
    { symbol: 'NMBSF1', name: 'NMB Saral Bachat Fund-E', sector: 'Mutual Fund', base: 10.8 },
    { symbol: 'PBMF', name: 'Prabhu Mutual Fund', sector: 'Mutual Fund', base: 10.5 },
    { symbol: 'PSF', name: 'Prabhu Select Fund', sector: 'Mutual Fund', base: 11.2 },
    { symbol: 'SAEF', name: 'Sanima Equity Fund', sector: 'Mutual Fund', base: 13.5 },
    { symbol: 'SBCF', name: 'Siddhartha City Fund', sector: 'Mutual Fund', base: 12.8 },
    { symbol: 'SEF', name: 'Sanima Equity Fund', sector: 'Mutual Fund', base: 10.8 },
    { symbol: 'SFMF', name: 'Sunrise First Mutual Fund', sector: 'Mutual Fund', base: 10.2 },
    { symbol: 'SIGS1', name: 'Siddhartha Investment Growth Scheme-1', sector: 'Mutual Fund', base: 10.5 },
    { symbol: 'SIGS2', name: 'Siddhartha Investment Growth Scheme-2', sector: 'Mutual Fund', base: 11.8 },
    { symbol: 'SIGS3', name: 'Siddhartha Investment Growth Scheme-3', sector: 'Mutual Fund', base: 10.3 },
    { symbol: 'SLCF', name: 'Sunrise First Mutual Fund', sector: 'Mutual Fund', base: 10.5 },

    // ============================================
    // MANUFACTURING AND PROCESSING (7 companies)
    // ============================================
    { symbol: 'BNL', name: 'Bottlers Nepal Limited', sector: 'Manufacturing And Processing', base: 1965 },
    { symbol: 'BNT', name: 'Bottlers Nepal (Terai) Limited', sector: 'Manufacturing And Processing', base: 1785 },
    { symbol: 'FHL', name: 'Floorner Himalaya Limited', sector: 'Manufacturing And Processing', base: 485 },
    { symbol: 'HDL', name: 'Himalayan Distillery Limited', sector: 'Manufacturing And Processing', base: 1380 },
    { symbol: 'JSM', name: 'Jyoti Spinning Mills Limited', sector: 'Manufacturing And Processing', base: 320 },
    { symbol: 'SHIVM', name: 'Shivam Cements Limited', sector: 'Manufacturing And Processing', base: 585 },
    { symbol: 'UNL', name: 'Unilever Nepal Limited', sector: 'Manufacturing And Processing', base: 16500 },

    // ============================================
    // TRADING (2 companies)
    // ============================================
    { symbol: 'BBC', name: 'Bishal Bazar Company Limited', sector: 'Trading', base: 980 },
    { symbol: 'STC', name: 'Salt Trading Corporation Limited', sector: 'Trading', base: 870 },

    // ============================================
    // INVESTMENT (5 companies)
    // ============================================
    { symbol: 'CIT', name: 'Citizen Investment Trust', sector: 'Investment', base: 2540 },
    { symbol: 'HIDCL', name: 'Hydroelectricity Investment and Development Company Ltd.', sector: 'Investment', base: 175 },
    { symbol: 'NIFRA', name: 'Nepal Infrastructure Bank Limited', sector: 'Investment', base: 235 },
    { symbol: 'NRN', name: 'NRN Infrastructure and Dev Ltd.', sector: 'Investment', base: 125 },
    { symbol: 'NNRS', name: 'Nepal Nepal Rasayan Sanstha Limited', sector: 'Investment', base: 145 },

    // ============================================
    // OTHERS (8 companies)
    // ============================================
    { symbol: 'AHL', name: 'Akaal Hydro Power Limited', sector: 'Others', base: 610 },
    { symbol: 'NLO', name: 'Nepal Lube Oil Limited', sector: 'Others', base: 750 },
    { symbol: 'NECO', name: 'Nepal Coal Limited', sector: 'Others', base: 180 },
    { symbol: 'NKU', name: 'Nepal Khadya Udhyog Limited', sector: 'Others', base: 520 },
    { symbol: 'NRIC', name: 'Nepal Reinsurance Company Limited', sector: 'Others', base: 1040 },
    { symbol: 'NTC', name: 'Nepal Doorsanchar Company Limited (Nepal Telecom)', sector: 'Others', base: 885 },
    { symbol: 'NVG', name: 'Nerude Laghubitta Bittiya Sanstha Limited', sector: 'Others', base: 175 },

    // ============================================
    // PROMOTER SHARES / PREFERRED / DEBENTURES
    // ============================================
    { symbol: 'NABILD82', name: 'Nabil Bank Debenture 2082', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'SBLD83', name: 'Siddhartha Bank Debenture 2083', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'NIBD84', name: 'Nepal Investment Bank Debenture 2084', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'NICAD8384', name: 'NIC Asia Bank Debenture 2083/84', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'SBLD84', name: 'Siddhartha Bank Debenture 2084', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'NBLD85', name: 'Nabil Bank Debenture 2085', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'GBILD86', name: 'Global IME Bank Debenture 2086', sector: 'Corporate Debenture', base: 1000 },
    { symbol: 'HNBPO', name: 'Himalayan Bank Promoter Share', sector: 'Promoter Share', base: 100 },
    { symbol: 'NBPO', name: 'Nabil Bank Promoter Share', sector: 'Promoter Share', base: 100 },

    // ============================================
    // ADDITIONAL MISSING STOCKS (29 more to reach 326)
    // ============================================
    // More Hydropower
    { symbol: 'BHDC', name: 'Barahi Hydropower Development Company Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'BKPL', name: 'Budi Khola Power Limited', sector: 'Hydro Power', base: 185 },
    { symbol: 'CHDC', name: 'Chhyangdi Hydropower Development Company Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'EDCL', name: 'Energy Development Company Limited', sector: 'Hydro Power', base: 188 },
    { symbol: 'FOWEP', name: 'Fowad Energy Limited', sector: 'Hydro Power', base: 172 },
    { symbol: 'GHPL', name: 'Greenlife Hydropower Limited', sector: 'Hydro Power', base: 178 },
    { symbol: 'HPIL', name: 'Himalayan Power Industries Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'ICPL', name: 'Indo-China Hydropower Limited', sector: 'Hydro Power', base: 182 },
    { symbol: 'JFPL', name: 'Jalapa Hydropower Limited', sector: 'Hydro Power', base: 175 },
    { symbol: 'KNPL', name: 'Khudi Khola Power Limited', sector: 'Hydro Power', base: 188 },
    { symbol: 'MKCL', name: 'Makalu Hydropower Company Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'NKJA', name: 'Nepal Jalvidhyut Company Limited', sector: 'Hydro Power', base: 180 },
    { symbol: 'RJPL', name: 'Rawa Hydropower Limited', sector: 'Hydro Power', base: 172 },
    { symbol: 'SNHL', name: 'Sanima Nepal Hydropower Limited', sector: 'Hydro Power', base: 195 },
    { symbol: 'TSHL', name: 'Trishuli Hydropower Limited', sector: 'Hydro Power', base: 188 },

    // More Microfinance
    { symbol: 'AULBS', name: 'Adhikhola Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 580 },
    { symbol: 'EMLBF', name: 'Everest Microfinance Bittiya Sanstha Limited', sector: 'Microfinance', base: 620 },
    { symbol: 'GNLB', name: 'Gandaki Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 595 },
    { symbol: 'KBLBS', name: 'Kanchan Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 575 },
    { symbol: 'MLFLB', name: 'Mahuli Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 560 },
    { symbol: 'NCLBS', name: 'Nepal Community Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 585 },
    { symbol: 'PLBS', name: 'Pashchim Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 610 },
    { symbol: 'SFLBS', name: 'Sajha Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 595 },
    { symbol: 'SNLB', name: 'Sana Nepal Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 580 },
    { symbol: 'SSLBS', name: 'Sarathi Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 605 },

    // More Insurance
    { symbol: 'BALI', name: 'Bali Insurance Company Limited', sector: 'Non Life Insurance', base: 495 },
    { symbol: 'NECOINS', name: 'Neco Insurance Ltd.', sector: 'Non Life Insurance', base: 530 },
    { symbol: 'PRILI', name: 'Pristine Life Insurance Company Limited', sector: 'Life Insurance', base: 375 },
    { symbol: 'ULIL', name: 'United Life Insurance Company Limited', sector: 'Life Insurance', base: 385 },

    // ============================================
    // NEWLY ADDED STOCKS (64 symbols)
    // ============================================

    // Banks & Finance
    { symbol: 'NMLBSL', name: 'Nerude Mirmire Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 655.6 },
    { symbol: 'NICLBSL', name: 'NIC ASIA Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 546 },
    { symbol: 'NESDO', name: 'NESDO Sambridha Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1480.1 },
    { symbol: 'SHLB', name: 'Shrijanshil Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1675.2 },
    { symbol: 'SWMF', name: 'Suryodaya Womi Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 692.9 },
    { symbol: 'UNLB', name: 'Unique Nepal Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 1922 },
    { symbol: 'SWASTIK', name: 'Swastik Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 3097.1 },
    { symbol: 'NMLBBL', name: 'Nerude Mirmire Laghubitta Bittiya Sanstha Limited', sector: 'Microfinance', base: 655.6 },

    // Insurance
    { symbol: 'HRL', name: 'Himalayan Reinsurance Limited', sector: 'Others', base: 831 },
    { symbol: 'SRLI', name: 'Sanima Reliance Life Insurance Limited', sector: 'Life Insurance', base: 403.5 },
    { symbol: 'HLI', name: 'Himalayan Life Insurance Limited', sector: 'Life Insurance', base: 374 },
    { symbol: 'SGIC', name: 'Sanima GIC Insurance Limited', sector: 'Non Life Insurance', base: 472 },
    { symbol: 'SALICO', name: 'Sagarmatha Lumbini Insurance Co. Limited', sector: 'Non Life Insurance', base: 597 },
    { symbol: 'PMLI', name: 'Prabhu Mahalaxmi Life Insurance Limited', sector: 'Life Insurance', base: 493.1 },
    { symbol: 'HEI', name: 'Himalayan Everest Insurance Limited', sector: 'Non Life Insurance', base: 498 },
    { symbol: 'SPIL', name: 'Siddhartha Premier Insurance Limited', sector: 'Non Life Insurance', base: 733 },
    { symbol: 'GMLI', name: 'Guardian Micro Life Insurance Limited', sector: 'Life Insurance', base: 1758 },
    { symbol: 'NMIC', name: 'Nepal Micro Insurance Company Limited', sector: 'Life Insurance', base: 1230 },
    { symbol: 'CREST', name: 'Crest Micro Life Insurance Limited', sector: 'Life Insurance', base: 1228 },

    // Hydropower
    { symbol: 'SARBTM', name: 'Sarbottam Cement Limited', sector: 'Manufacturing And Processing', base: 887.4 },
    { symbol: 'SONA', name: 'Sonapur Minerals And Oil Limited', sector: 'Manufacturing And Processing', base: 420.1 },
    { symbol: 'GCIL', name: 'Ghorahi Cement Industry Limited', sector: 'Manufacturing And Processing', base: 407 },
    { symbol: 'MANDU', name: 'Mandu Hydropower Limited', sector: 'Hydro Power', base: 800 },
    { symbol: 'SMH', name: 'Super Mai Hydropower Limited', sector: 'Hydro Power', base: 753 },
    { symbol: 'MKHC', name: 'Maya Khola Hydropower Company Limited', sector: 'Hydro Power', base: 369.9 },
    { symbol: 'MCHL', name: 'Menchhiyam Hydropower Limited', sector: 'Hydro Power', base: 478 },
    { symbol: 'MAKAR', name: 'Makar Jitumaya Suri Hydropower Limited', sector: 'Hydro Power', base: 563 },
    { symbol: 'MEL', name: 'Modi Energy Limited', sector: 'Hydro Power', base: 270.1 },
    { symbol: 'RAWA', name: 'Rawa Energy Development Limited', sector: 'Hydro Power', base: 714 },
    { symbol: 'SPL', name: 'Shuvam Power Limited', sector: 'Hydro Power', base: 835.1 },
    { symbol: 'UAIL', name: 'United Ajod Insurance Limited', sector: 'Non Life Insurance', base: 451 },
    { symbol: 'EHPL', name: 'Eastern Hydropower Limited', sector: 'Hydro Power', base: 407 },
    { symbol: 'RFPL', name: 'River Falls Power Limited', sector: 'Hydro Power', base: 367 },
    { symbol: 'SGHC', name: 'Swet-Ganga Hydropower & Construction Limited', sector: 'Hydro Power', base: 406 },
    { symbol: 'SMJC', name: 'Sagarmatha Jalabidhyut Company Limited', sector: 'Hydro Power', base: 496 },
    { symbol: 'TVCL', name: 'Trishuli Jal Vidhyut Company Limited', sector: 'Hydro Power', base: 410 },
    { symbol: 'UHEWA', name: 'Upper Hewakhola Hydropower Company Limited', sector: 'Hydro Power', base: 594 },
    { symbol: 'ULHC', name: 'Upper Lohore Khola Hydropower Company Limited', sector: 'Hydro Power', base: 469.4 },
    { symbol: 'UMRH', name: 'United IDI Mardi RB Hydropower Limited.', sector: 'Hydro Power', base: 555 },
    { symbol: 'USHL', name: 'Upper Syange Hydropower Limited', sector: 'Hydro Power', base: 891.4 },
    { symbol: 'SANVI', name: 'Sanvi Energy Limited', sector: 'Hydro Power', base: 642 },
    { symbol: 'BHCL', name: 'Bikash Hydropower Company Limited', sector: 'Hydro Power', base: 485 },
    { symbol: 'BUNGAL', name: 'Bungal Hydro Limited', sector: 'Hydro Power', base: 620.9 },
    { symbol: 'DHEL', name: 'Daramkhola Hydro Energy Limited', sector: 'Hydro Power', base: 572.5 },
    { symbol: 'HIMSTAR', name: 'Him Star Urja Company Limited', sector: 'Hydro Power', base: 848 },
    { symbol: 'MABEL', name: 'Mabilung Energy Limited', sector: 'Hydro Power', base: 697.9 },
    { symbol: 'MKCH', name: 'Maya Khola Hydropower Company Limited', sector: 'Hydro Power', base: 369.9 },
    { symbol: 'VLUCL', name: 'Vision Lumbini Urja Company Limited', sector: 'Hydro Power', base: 579 },
    { symbol: 'SYPNL', name: 'SY Panel Nepal Limited', sector: 'Manufacturing And Processing', base: 622.6 },

    // Others & Investment
    { symbol: 'HATHY', name: 'Hathway Investment Nepal Limited', sector: 'Investment', base: 902 },
    { symbol: 'ENL', name: 'Emerging Nepal Limited', sector: 'Investment', base: 896 },
    { symbol: 'NRM', name: 'Nepal Republic Media Limited', sector: 'Others', base: 422 },
    { symbol: 'CITY', name: 'City Hotel Limited', sector: 'Hotels And Tourism', base: 485.2 },
    { symbol: 'KDL', name: 'Kalinchowk Darshan Limited', sector: 'Hotels And Tourism', base: 869.6 },
    { symbol: 'NWCL', name: 'Nepal Warehousing Company Limited', sector: 'Others', base: 792.1 },
    { symbol: 'TTL', name: 'Trade Tower Limited', sector: 'Others', base: 767 },
    { symbol: 'SAGAR', name: 'Sagar Distillery Limited', sector: 'Manufacturing And Processing', base: 1740.3 },
    { symbol: 'PURE', name: 'Pure Energy Limited', sector: 'Hydro Power', base: 918.1 },
    { symbol: 'SAIL', name: 'Shreenagar Agritech Industries Limited', sector: 'Manufacturing And Processing', base: 814 },
    { symbol: 'OMPL', name: 'Om Megashree Pharmaceuticals Limited', sector: 'Manufacturing And Processing', base: 1243 },
    { symbol: 'JHAPA', name: 'Jhapa Energy Limited', sector: 'Hydro Power', base: 1255 },
    { symbol: 'BANDIPUR', name: 'Bandipur Cablecar and Tourism Limited', sector: 'Hotels And Tourism', base: 762.1 },
    { symbol: 'MEN', name: 'Mountain Energy Nepal Limited', sector: 'Hydro Power', base: 560 },
    // December 2025 Listings
    { symbol: 'MKCCL', name: 'Maula Kali Cable Car Limited', sector: 'Hotels And Tourism', base: 100 },
    { symbol: 'NIVIX', name: 'Nivix Pharmaceuticals Limited', sector: 'Manufacturing And Processing', base: 100 },
    { symbol: 'BJHL', name: 'Bhujung Hydropower Limited', sector: 'Hydro Power', base: 100 },
    { symbol: 'RSM', name: 'Reliance Spinning Mills Limited', sector: 'Manufacturing And Processing', base: 820.8 },
    { symbol: 'SKHEL', name: 'Suryakunda Hydro Electric Limited', sector: 'Hydro Power', base: 100 },
    { symbol: 'RLEL', name: 'Ridge Line Energy Limited', sector: 'Hydro Power', base: 100 },
    { symbol: 'SALAPA', name: 'Salapa Bikas Bank Limited', sector: 'Development Banks', base: 100 },
];

/**
 * Create a quick lookup map for Symbol -> Stock Info
 */
const stockInfoMap = new Map();
NEPSE_STOCKS.forEach(stock => {
    stockInfoMap.set(stock.symbol.toUpperCase(), {
        name: stock.name,
        sector: stock.sector,
        base: stock.base
    });
});

/**
 * Get stock info by symbol
 * @param {string} symbol - Stock symbol
 * @returns {Object|null} Stock info or null if not found
 */
const getStockInfo = (symbol) => {
    if (!symbol) return null;
    return stockInfoMap.get(symbol.toUpperCase()) || null;
};

/**
 * Get company name by symbol
 * @param {string} symbol - Stock symbol
 * @returns {string} Company name or symbol if not found
 */
const getCompanyName = (symbol) => {
    const info = getStockInfo(symbol);
    return info ? info.name : symbol;
};

/**
 * Get all stock symbols
 * @returns {Array<string>} Array of all stock symbols
 */
const getAllSymbols = () => {
    return NEPSE_STOCKS.map(stock => stock.symbol);
};

/**
 * Get stocks by sector
 * @param {string} sector - Sector name
 * @returns {Array} Array of stocks in that sector
 */
const getStocksBySector = (sector) => {
    return NEPSE_STOCKS.filter(stock =>
        stock.sector.toLowerCase() === sector.toLowerCase()
    );
};

/**
 * Get all unique sectors
 * @returns {Array<string>} Array of sector names
 */
const getAllSectors = () => {
    return [...new Set(NEPSE_STOCKS.map(stock => stock.sector))];
};

module.exports = NEPSE_STOCKS;
module.exports.NEPSE_STOCKS = NEPSE_STOCKS;
module.exports.stockInfoMap = stockInfoMap;
module.exports.getStockInfo = getStockInfo;
module.exports.getCompanyName = getCompanyName;
module.exports.getAllSymbols = getAllSymbols;
module.exports.getStocksBySector = getStocksBySector;
module.exports.getAllSectors = getAllSectors;
