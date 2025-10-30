export default async (request, context) => {
  // Получаем геоданные из Netlify (встроенная функция)
  const country = context.geo?.country?.code || 'TH';
  
  console.log('🌍 Edge Function: Country detected =', country);
  
  // Маппинг стран на телефонные коды
  const countryToPhone = {
    'RU': '+7', 'KZ': '+7', 'BY': '+375', 'UA': '+380', 
    'TH': '+66', 'US': '+1', 'CA': '+1', 'GB': '+44', 
    'DE': '+49', 'FR': '+33', 'IT': '+39', 'ES': '+34', 
    'PL': '+48', 'CZ': '+420', 'TR': '+90', 'GE': '+995', 
    'AM': '+374', 'AZ': '+994', 'UZ': '+998', 'KG': '+996', 
    'TJ': '+992', 'TM': '+993', 'IL': '+972', 'AE': '+971',
    'LV': '+371', 'LT': '+370', 'EE': '+372', 'MD': '+373',
    'RS': '+381', 'SI': '+386', 'SK': '+421', 'HR': '+385',
    'RO': '+40', 'BG': '+359', 'GR': '+30', 'HU': '+36',
    'AT': '+43', 'CH': '+41', 'SE': '+46', 'NO': '+47',
    'FI': '+358', 'DK': '+45', 'NL': '+31', 'BE': '+32',
    'PT': '+351', 'IE': '+353', 'IS': '+354', 'AL': '+355',
    'ME': '+382', 'MK': '+389', 'BA': '+387', 'XK': '+383',
    'CN': '+86', 'JP': '+81', 'KR': '+82', 'IN': '+91',
    'VN': '+84', 'ID': '+62', 'MY': '+60', 'SG': '+65',
    'PH': '+63', 'MM': '+95', 'KH': '+855', 'LA': '+856',
    'BD': '+880', 'PK': '+92', 'NP': '+977', 'LK': '+94',
    'AF': '+93', 'IR': '+98', 'IQ': '+964', 'SA': '+966',
    'AE': '+971', 'KW': '+965', 'QA': '+974', 'BH': '+973',
    'OM': '+968', 'JO': '+962', 'LB': '+961', 'SY': '+963',
    'YE': '+967', 'EG': '+20', 'LY': '+218', 'DZ': '+213',
    'MA': '+212', 'TN': '+216', 'ZA': '+27', 'NG': '+234',
    'KE': '+254', 'ET': '+251', 'TZ': '+255', 'UG': '+256',
    'GH': '+233', 'CM': '+237', 'ZM': '+260', 'ZW': '+263',
    'AU': '+61', 'NZ': '+64', 'BR': '+55', 'AR': '+54',
    'CL': '+56', 'CO': '+57', 'PE': '+51', 'MX': '+52',
    'VE': '+58', 'EC': '+593', 'BO': '+591', 'PY': '+595',
    'UY': '+598', 'CR': '+506', 'PA': '+507', 'GT': '+502',
    'SV': '+503', 'HN': '+504', 'NI': '+505', 'CU': '+53',
    'DO': '+1', 'JM': '+1', 'TT': '+1', 'BB': '+1'
  };
  
  const phoneCode = countryToPhone[country] || '+66';
  
  // Получаем оригинальный HTML
  const response = await context.next();
  const html = await response.text();
  
  // Инжектим JavaScript который установит нужную маску
  const script = `
<script>
(function() {
  const detectedCountry = '${country}';
  const detectedPhone = '${phoneCode}';
  
  console.log('🎯 Server detected:', detectedCountry, detectedPhone);
  
  window.addEventListener('DOMContentLoaded', function() {
    const countrySelect = document.getElementById('countryCode');
    if (countrySelect) {
      // Сначала ищем по коду страны (data-country)
      let option = Array.from(countrySelect.options).find(opt => 
        opt.getAttribute('data-country') === detectedCountry
      );
      
      // Если не нашли по коду страны, ищем по телефонному коду
      if (!option) {
        option = Array.from(countrySelect.options).find(opt => 
          opt.value === detectedPhone
        );
      }
      
      if (option) {
        countrySelect.value = detectedPhone;
        
        // Триггерим событие change для обновления placeholder
        const changeEvent = new Event('change', { bubbles: true });
        countrySelect.dispatchEvent(changeEvent);
        
        console.log('✅ Страна установлена автоматически:', detectedCountry, '→', detectedPhone);
      } else {
        console.warn('⚠️ Страна не найдена в списке:', detectedCountry);
      }
    } else {
      console.warn('⚠️ Элемент countryCode не найден');
    }
  });
})();
</script>`;
  
  // Вставляем перед закрывающим </head>
  const modifiedHtml = html.replace('</head>', script + '\n</head>');
  
  return new Response(modifiedHtml, {
    status: response.status,
    headers: {
      ...response.headers,
      'content-type': 'text/html; charset=utf-8',
      'x-detected-country': country,
      'x-detected-phone': phoneCode,
      'cache-control': 'public, max-age=0, must-revalidate'
    }
  });
};

export const config = {
  path: ["/phuket-*", "/"]
};
