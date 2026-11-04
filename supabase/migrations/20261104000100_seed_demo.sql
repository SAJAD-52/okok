-- ============================================================================
-- JADIJCB: Seed Demo Data for Moroccan Heavy Machinery Marketplace
-- Migration: 20261104000100_seed_demo.sql
-- Description: Provisions demo owner accounts, storefronts, and 12 realistic
-- heavy construction machines across key Moroccan economic hubs.
-- ============================================================================

-- 1. Create Demo Profiles (using deterministic UUIDs)
-- Note: inserting dummy user rows in auth.users if they don't already exist
DO $$
DECLARE
  v_owner_casa uuid := 'd0000000-0000-0000-0000-000000000001';
  v_owner_tanger uuid := 'd0000000-0000-0000-0000-000000000002';
  v_owner_marrakech uuid := 'd0000000-0000-0000-0000-000000000003';
  v_admin uuid := 'd0000000-0000-0000-0000-000000000099';
BEGIN
  -- Insert auth.users stubs for foreign keys
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_casa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atlas.engins@jadijcb.ma', crypt('Demo123456!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Atlas Engins Casablanca","phone":"+212522980001"}', now(), now()),
    (v_owner_tanger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'detroit.btp@jadijcb.ma', crypt('Demo123456!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Detroit BTP Tanger","phone":"+212539320002"}', now(), now()),
    (v_owner_marrakech, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'menara.loc@jadijcb.ma', crypt('Demo123456!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ménara Loc Sud","phone":"+212524430003"}', now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@jadijcb.ma', crypt('AdminJcb2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"JADIJCB Platform Admin","phone":"+212522000099","role":"admin"}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Ensure Profiles exist with ACTIVE subscriptions so RLS allows reads & demo interactions
  INSERT INTO public.profiles (
    id, phone, full_name, company_name, role, city, whatsapp_verified, subscription_status, subscription_ends_at, preferred_lang
  ) VALUES
    (v_owner_casa, '+212522980001', 'Hassan El Alami', 'Atlas Engins Maroc SARL', 'owner', 'Casablanca', true, 'active', now() + interval '365 days', 'ar'),
    (v_owner_tanger, '+212539320002', 'Tariq Benabdelkader', 'Détroit BTP & Carrières', 'owner', 'Tanger', true, 'active', now() + interval '365 days', 'fr'),
    (v_owner_marrakech, '+212524430003', 'Rachid Amrani', 'Ménara Logistique & Matériel', 'owner', 'Marrakech', true, 'active', now() + interval '365 days', 'ar'),
    (v_admin, '+212522000099', 'Support JADIJCB', 'JADIJCB Maroc S.A.', 'admin', 'Casablanca', true, 'active', now() + interval '3650 days', 'ar')
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    subscription_status = 'active',
    subscription_ends_at = EXCLUDED.subscription_ends_at;

  -- Insert Storefronts for the demo owners
  INSERT INTO public.storefronts (owner_id, slug, banner_url, about_ar, about_fr, whatsapp, theme_color)
  VALUES
    (v_owner_casa, 'atlas-engins', 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1200&q=80', 'شركة رائدة في كراء آليات الأشغال العمومية ومعدات الحفر بجهة الدار البيضاء سطات منذ 15 عاماً. أسطول مجهز وسائقون معتمدون.', 'Leader de la location d''engins de terrassement et génie civil dans la région Casablanca-Settat depuis 15 ans. Matériel contrôlé et chauffeurs certifiés.', '+212661889901', '#FFB400'),
    (v_owner_tanger, 'detroit-btp', 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80', 'شريككم الموثوق في الشمال لمشاريع البنية التحتية، الموانئ ومقالع الحصى بطنجة وتطوان.', 'Votre partenaire de confiance dans le Nord pour chantiers d''infrastructures portuaires et carrières à Tanger-Med.', '+212661889902', '#FFB400'),
    (v_owner_marrakech, 'menara-loc', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80', 'توفير الآليات الثقيلة لمشاريع الطرقات وتوسعة المدن في مراكش والجنوب المغربي بأسعار تنافسية.', 'Fourniture d''engins lourds pour terrassement et voirie à Marrakech et tout le Sud marocain.', '+212661889903', '#FFB400')
  ON CONFLICT (owner_id) DO NOTHING;
END $$;

-- 2. Insert 12 Realistic Moroccan Heavy Machinery Listings (Bilingual, Rent & Sale)
INSERT INTO public.machines (
  id,
  owner_id,
  title_ar,
  title_fr,
  description_ar,
  description_fr,
  category,
  brand,
  model,
  year,
  listing_mode,
  condition,
  city,
  lat,
  lng,
  hourly_rate,
  daily_rate,
  weekly_rate,
  sale_price,
  with_operator,
  fuel_included,
  delivery_available,
  images,
  is_published,
  views_count
) VALUES
  -- 1. Tractopelle JCB 3CX (Casablanca - Rent)
  (
    'm0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'جرافة وتراكتوبيل JCB 3CX Eco مجهزة بسائق محترف [عرض تجريبي]',
    'Tractopelle JCB 3CX Eco avec chauffeur qualifié [Démo]',
    'آلية متعددة الاستخدامات مع دلو 4 في 1 وذراع تمديد إضافي. فحص تقني سنوي ساري وتأمين شامل. جاهزة للعمل بأوراش الدار البيضاء والنواحي.',
    'Tractopelle polyvalent avec godet 4-en-1 et bras télescopique. Contrôle technique à jour, assurance chantier complète. Disponible immédiatement sur Casablanca et région.',
    'loader',
    'JCB',
    '3CX Eco',
    2022,
    'rent',
    'used',
    'Casablanca',
    33.5731,
    -7.5898,
    220.00,
    1800.00,
    10800.00,
    NULL,
    true,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1579275542618-a1dfed5f54ba?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    142
  ),

  -- 2. Pelle Caterpillar 320D (Tanger - Rent)
  (
    'm0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'حفارة مجنزرة كاتر بيلر CAT 320D لأعمال الحفر الصخري [عرض تجريبي]',
    'Pelle hydraulique sur chenilles CAT 320D [Démo]',
    'حفارة هيدروليكية 22 طن مزودة بدلو حفر 1.2 متر مكعب وخط هيدروليكي للمطرقة الهيدروليكية BRH. مثالية لمشاريع طنجة المتوسط والمقالع.',
    'Pelle sur chenilles 22 tonnes avec godet 1.2 m³ et ligne BRH. Idéale pour terrassement lourd et chantiers portuaires de Tanger Med.',
    'excavator',
    'Caterpillar',
    '320D',
    2021,
    'rent',
    'used',
    'Tanger',
    35.7595,
    -5.8340,
    380.00,
    3200.00,
    19200.00,
    NULL,
    true,
    true,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    215
  ),

  -- 3. Bulldozer Komatsu D65EX (Marrakech - Rent)
  (
    'm0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'بلدوزر كوماتسو Komatsu D65EX لتسوية الأراضي الكبرى [عرض تجريبي]',
    'Bulldozer Komatsu D65EX de nivellement [Démo]',
    'قوة 205 حصان مع شفرة SIGMADOZER ومشرط خلفي ثنائي. مخصص لفتح الطرقات الصحراوية والجبلية وتسوية الأراضي الشاسعة بجهة مراكش آسفي.',
    'Puissance 205 ch avec lame Sigmadozer et ripper arrière. Conçu pour nivellement massif, ouverture de pistes et carrières dans le Sud.',
    'bulldozer',
    'Komatsu',
    'D65EX-16',
    2020,
    'rent',
    'used',
    'Marrakech',
    31.6295,
    -7.9811,
    500.00,
    4200.00,
    25000.00,
    NULL,
    true,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    89
  ),

  -- 4. Grue Mobile Liebherr LTM 1050 (Casablanca - Rent)
  (
    'm0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'رافعة متحركة هيدروليكية ليبهر 50 طن Liebherr LTM 1050 [عرض تجريبي]',
    'Grue télescopique mobile 50 Tonnes Liebherr LTM 1050 [Démo]',
    'حمولة رفع قصوى 50 طن وذراع تلسكوبي بطول 38 متراً. متوفرة مع طاقم مناورة معتمد وتأمين أوراش لعمليات الرفع الدقيقة بالدار البيضاء.',
    'Capacité maximale de levage 50T avec flèche télescopique de 38m. Équipage de grutiers agréés pour montages industriels et génie civil.',
    'crane',
    'Liebherr',
    'LTM 1050-3.1',
    2019,
    'rent',
    'used',
    'Casablanca',
    33.5898,
    -7.6038,
    800.00,
    6500.00,
    39000.00,
    NULL,
    true,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    188
  ),

  -- 5. Camion Benne Mercedes Actros 3340 (Rabat - Rent)
  (
    'm0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000001',
    'شاحنة قلاب مرسيدس أكتروس 6x4 سعة 16 متر مكعب [عرض تجريبي]',
    'Camion benne 6x4 Mercedes Actros 3340 16m³ [Démo]',
    'شاحنة قوية لنقل الرمال والركام والإسفلت الساخن. مجهزة بسائق محترف، جاهزة لخدمة أوراش الرباط، سلا والقنيطرة.',
    'Camion benne renforcé 6x4 pour évacuation déblais et transport agrégats. Chauffeur expérimenté et autorisation de circulation BTP.',
    'truck',
    'Mercedes-Benz',
    'Actros 3340 6x4',
    2021,
    'rent',
    'used',
    'Rabat',
    34.0209,
    -6.8416,
    180.00,
    1500.00,
    9000.00,
    NULL,
    true,
    true,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    96
  ),

  -- 6. Compacteur Bomag BW 213 (Agadir - Rent)
  (
    'm0000000-0000-0000-0000-000000000006',
    'd0000000-0000-0000-0000-000000000003',
    'مدحلة اهتزازية بوماغ Bomag BW 213 D-5 لدمج التربة [عرض تجريبي]',
    'Compacteur monocylindre vibrant Bomag BW 213 D-5 [Démo]',
    'وزن تشغيلي 13 طن مع نظام قياس التراص Terrameter. ضرورية لأشغال تعبيد الطرق والتهيئة الحضرية بسوس وأكادير.',
    'Compacteur 13T pour terrassement lourd et voiries avec mesure de compactage en continu. Disponible région Souss-Massa.',
    'compactor',
    'Bomag',
    'BW 213 D-5',
    2021,
    'rent',
    'used',
    'Agadir',
    30.4278,
    -9.5981,
    200.00,
    1600.00,
    9600.00,
    NULL,
    true,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    73
  ),

  -- 7. Chariot Télescopique Manitou MT 1840 (Fès - Rent)
  (
    'm0000000-0000-0000-0000-000000000007',
    'd0000000-0000-0000-0000-000000000002',
    'رافعة شوكية تلسكوبية مانيتو Manitou MT 1840 ارتفاع 18م [عرض تجريبي]',
    'Chariot télescopique tout-terrain Manitou MT 1840 [Démo]',
    'ارتفاع رفع 18 متراً وحمولة 4 أطنان. مزودة بركائز تثبيت هيدروليكية وشوكات مناولة مع سلة أفراد. مثالية لمشاريع البناء بفاس ومكناس.',
    'Hauteur de levage 18m, capacité 4T avec stabilisateurs et nacelle orientable. Idéal pour charpente métallique et second-œuvre.',
    'forklift',
    'Manitou',
    'MT 1840 Easy',
    2022,
    'rent',
    'used',
    'Fès',
    34.0331,
    -5.0003,
    240.00,
    1900.00,
    11400.00,
    NULL,
    true,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1579275542618-a1dfed5f54ba?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    112
  ),

  -- 8. Groupe Électrogène Cummins 250 kVA (Tanger - Rent)
  (
    'm0000000-0000-0000-0000-000000000008',
    'd0000000-0000-0000-0000-000000000002',
    'مولد كهربائي صناعي صامت Cummins 250 kVA [عرض تجريبي]',
    'Groupe électrogène insonorisé Cummins 250 kVA [Démo]',
    'مولد ديزل كاتم للصوت بقوة 250 كيلو فولت أمبير. خزان مدمج بسعة 500 لتر ولوحة تحكم رقمية أوتوماتيكية لأوراش طنجة والمناطق الحرة.',
    'Groupe industriel 250 kVA insonorisé avec cuve grande autonomie et armoire inverseuse de source automatique.',
    'generator',
    'Cummins',
    'C250 D5',
    2023,
    'rent',
    'new',
    'Tanger',
    35.7720,
    -5.8120,
    120.00,
    950.00,
    5700.00,
    NULL,
    false,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    64
  ),

  -- 9. Pompe à Béton sur Camion Putzmeister 36m (Casablanca - Rent)
  (
    'm0000000-0000-0000-0000-000000000009',
    'd0000000-0000-0000-0000-000000000001',
    'شاحنة مضخة خرسانة بوتسمايستر 36 متراً Putzmeister BSF 36 [عرض تجريبي]',
    'Camion pompe à béton Putzmeister BSF 36-4 [Démo]',
    'مضخة بطول ذراع 36 متراً وتدفق خرسانة 160 متر مكعب/ساعة. صب الخرسانة بدقة للأبراج والمجمعات السكنية الكبرى بالدار البيضاء وبوسكورة.',
    'Flèche 36m en 4 éléments, débit 160 m³/h. Équipe de pompage experte pour coulage de dalles et radiers volumineux.',
    'concrete-mixer',
    'Putzmeister',
    'BSF 36-4 16H',
    2020,
    'rent',
    'used',
    'Casablanca',
    33.5210,
    -7.6320,
    750.00,
    5800.00,
    34800.00,
    NULL,
    true,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    134
  ),

  -- 10. Chargeuse sur Pneus Caterpillar 966H (Casablanca - SALE)
  (
    'm0000000-0000-0000-0000-000000000010',
    'd0000000-0000-0000-0000-000000000001',
    'شاحنة جرافة كاتر بيلر CAT 966H بحالة ممتازة للبيع [عرض تجريبي]',
    'Chargeuse sur pneus Caterpillar 966H à vendre [Démo]',
    'جرافة 24 طن، محرك CAT C11 بقوة 262 حصان. ساعات عمل: 7 400 ساعة. إطارات جديدة بنسبة 85%، مضخة وصمامات هيدروليكية أصلية، جاهزة للفحص.',
    'Chargeuse 24T avec moteur Cat C11 ACERT. 7 400 heures réelles certifiées. Pneus neufs à 85%, godet 4.2 m³ en acier anti-usure Hardox.',
    'loader',
    'Caterpillar',
    '966H',
    2018,
    'sale',
    'used',
    'Casablanca',
    33.5500,
    -7.6100,
    NULL,
    NULL,
    NULL,
    1150000.00,
    false,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1579275542618-a1dfed5f54ba?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    340
  ),

  -- 11. Mini-Pelle JCB 8018 CTS (Rabat - SALE)
  (
    'm0000000-0000-0000-0000-000000000011',
    'd0000000-0000-0000-0000-000000000001',
    'حفارة صغيرة JCB 8018 CTS للبيع مع 3 دلاء حفر [عرض تجريبي]',
    'Mini-pelle JCB 8018 CTS avec 3 godets à vendre [Démo]',
    'وزن 1.8 طن، مثالية للأشغال الضيقة وقنوات الصرف الصحي والمسابح. جنازير مطاطية بحالة جيدة جداً، 2 100 ساعة عمل فقط.',
    'Poids opérationnel 1.8T, idéale pour réseaux souterrains, assainissement et espaces confinés. 2 100 heures d''origine avec attache rapide.',
    'excavator',
    'JCB',
    '8018 CTS',
    2020,
    'sale',
    'used',
    'Rabat',
    34.0150,
    -6.8320,
    NULL,
    NULL,
    NULL,
    240000.00,
    false,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    275
  ),

  -- 12. Pelle Neuve Komatsu PC210LC-10 (Tanger - SALE)
  (
    'm0000000-0000-0000-0000-000000000012',
    'd0000000-0000-0000-0000-000000000002',
    'حفارة هيدروليكية كوماتسو جديدة 2024 Komatsu PC210LC-10 للبيع [عرض تجريبي]',
    'Pelle hydraulique neuve Komatsu PC210LC-10 2024 à vendre [Démo]',
    'آلية جديدة كلياً صفر ساعة عمل، وارد الوكيل المعتمد مع ضمان سنتين أو 3 000 ساعة عمل. محرك موفر للوقود ونظام ملاحة ومراقبة Komtrax.',
    'Machine neuve 0 heure, garantie constructeur 2 ans ou 3 000 h. Équipée de télématique Komtrax 5 et cabine climatisée ROPS/FOPS niveau 2.',
    'excavator',
    'Komatsu',
    'PC210LC-10',
    2024,
    'sale',
    'new',
    'Tanger',
    35.7480,
    -5.8450,
    NULL,
    NULL,
    NULL,
    1850000.00,
    false,
    false,
    true,
    ARRAY[
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1000&q=80'
    ],
    true,
    490
  )
ON CONFLICT (id) DO UPDATE SET
  title_ar = EXCLUDED.title_ar,
  title_fr = EXCLUDED.title_fr,
  daily_rate = EXCLUDED.daily_rate,
  sale_price = EXCLUDED.sale_price,
  is_published = true;
