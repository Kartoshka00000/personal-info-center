// =================================== 1. КОНСТАНТЫ И API КЛЮЧИ ===================================
// API Погоды (Open-Meteo, не требует ключа)
const OPEN_METEO_URL = (lat, lon) => 
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
// Geocoding API для получения координат по названию города
const GEOCODING_URL = (city) => 
    `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=ru&format=json`;

// Статические факты о кошках (для локального использования)
const CAT_FACTS = [
    "Кошки спят около 70% своей жизни.",
    "Самая старая кошка дожила до 38 лет.",
    "У кошек 32 мышцы в каждом ухе.",
    "Кошачьи носы имеют уникальный отпечаток, как человеческие отпечатки пальцев.",
    "Кошки могут издавать около 100 различных звуков, в то время как собаки — только около 10.",
    "У кошек нет ключиц, поэтому они могут протискиваться в очень узкие места.",
    "Кошка по имени Стаббс была почетным мэром города Талкитна на Аляске в течение 20 лет."
];


// =================================== 2. УПРАВЛЕНИЕ UI И ВКЛАДКАМИ ===================================

function switchTab(targetId) {
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('#tabs button').forEach(button => {
        button.classList.remove('active');
    });

    const targetElement = document.getElementById(targetId);
    if (targetElement) {
        targetElement.classList.add('active');
    }
    const targetButton = document.querySelector(`[data-tab="${targetId}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }
}

function showSpinner(targetElement = null) {
    if (targetElement) {
        // Заменяем содержимое целевого элемента на спиннер
        targetElement.innerHTML = '<div class="spinner"></div>';
    } else {
        // Показываем общий спиннер
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.style.display = 'block';
    }
}

function hideSpinner() {
    // Скрываем общий спиннер
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
}


// =================================== 3. LOCAL STORAGE и ПРОФИЛЬ ===================================

function saveProfile() {
    const userNameElement = document.getElementById('userName');
    const themeToggleElement = document.getElementById('themeToggle');
    const avatarPreviewElement = document.getElementById('avatarPreview');

    const name = userNameElement ? userNameElement.value : '';
    const isDark = themeToggleElement ? themeToggleElement.checked : false;
    const avatarDataUrl = avatarPreviewElement ? avatarPreviewElement.src : '';
    
    localStorage.setItem('userName', name);
    localStorage.setItem('isDarkTheme', isDark.toString());
    localStorage.setItem('userAvatar', avatarDataUrl);
    
    // Применяем тему сразу
    applyTheme(isDark);
}

function applyTheme(isDark) {
    // Гарантированное применение класса к <body>
    document.body.classList.toggle('dark-theme', isDark);
}

function loadProfile() {
    const name = localStorage.getItem('userName');
    const isDark = localStorage.getItem('isDarkTheme') === 'true'; 
    const avatarDataUrl = localStorage.getItem('userAvatar');
    
    const userNameElement = document.getElementById('userName');
    const themeToggleElement = document.getElementById('themeToggle');
    const avatarElement = document.getElementById('avatarPreview');

    if (userNameElement && name) {
        userNameElement.value = name;
    }
    
    if (themeToggleElement) {
        themeToggleElement.checked = isDark;
    }
    applyTheme(isDark); // ПРИМЕНЕНИЕ ТЕМЫ ПРИ ЗАГРУЗКЕ

    if (avatarElement) {
        if (avatarDataUrl && avatarDataUrl.startsWith('data:image')) {
            avatarElement.src = avatarDataUrl;
        } else {
            avatarElement.src = "https://via.placeholder.com/150?text=Avatar";
        }
    }

    renderWeatherHistory();
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const avatarElement = document.getElementById('avatarPreview');
            if (avatarElement) {
                avatarElement.src = e.target.result;
                saveProfile(); 
            }
        };
        reader.readAsDataURL(file); 
    }
}

function saveWeatherHistory(city) {
    let history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
    const newEntry = { 
        city: city, 
        time: new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}) 
    };
    history.unshift(newEntry);
    history = history.slice(0, 3);
    localStorage.setItem('weatherHistory', JSON.stringify(history));
    renderWeatherHistory();
}

function renderWeatherHistory() {
    const historyUl = document.getElementById('weatherHistory');
    if (!historyUl) return;

    let history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
    
    if (history.length === 0) {
        historyUl.innerHTML = '<li class="muted">Нет сохраненных запросов.</li>';
        return;
    }
    
    historyUl.innerHTML = history.map(item => 
        `<li><span class="history-item">${item.city}</span> (${item.time})</li>`
    ).join('');
}

function clearAllData() {
    if (confirm("Вы уверены, что хотите очистить все сохраненные данные?")) {
        localStorage.clear();
        location.reload(); 
    }
}


// =================================== 4. API №1: ПОГОДА (Open-Meteo) ===================================

function getWeatherDescription(weatherCode) {
    switch (weatherCode) {
        case 0: return 'Ясное небо';
        case 1: case 2: case 3: return 'Переменная облачность';
        case 45: case 48: return 'Туман';
        case 51: case 53: case 55: return 'Морось';
        case 61: case 63: case 65: return 'Дождь';
        case 80: case 81: case 82: return 'Ливень';
        case 71: case 73: case 75: return 'Снегопад';
        default: return 'Неизвестно';
    }
}

async function fetchWeather() {
    const cityInput = document.getElementById('cityInput');
    const resultDiv = document.getElementById('weatherResult');
    if (!cityInput || !resultDiv) return;

    const city = cityInput.value.trim();
    resultDiv.innerHTML = '';
    
    if (!city) {
        resultDiv.innerHTML = '<p class="error">⚠️ Пожалуйста, введите название города.</p>';
        return;
    }

    showSpinner(resultDiv); 

    try {
        const geoResponse = await fetch(GEOCODING_URL(city));
        if (!geoResponse.ok) {
            throw new Error(`Ошибка Geocoding API (${geoResponse.status})`);
        }
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            resultDiv.innerHTML = `<p class="error">❌ Город "${city}" не найден.</p>`;
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];

        const weatherResponse = await fetch(OPEN_METEO_URL(latitude, longitude));
        if (!weatherResponse.ok) {
            throw new Error(`Ошибка Open-Meteo API (${weatherResponse.status})`);
        }
        const weatherData = await weatherResponse.json();
        
        if (!weatherData.current_weather) {
            resultDiv.innerHTML = `<p class="error">❌ Не удалось получить текущую погоду для ${name}.</p>`;
            return;
        }

        renderWeather(weatherData.current_weather, name, country);
        saveWeatherHistory(`${name}, ${country}`); 
        
    } catch (error) {
        resultDiv.innerHTML = `<p class="error">❌ Ошибка загрузки погоды: ${error.message}</p>`;
    } 
}

function renderWeather(data, cityName, countryName) {
    const resultDiv = document.getElementById('weatherResult');
    if (!resultDiv) return;
    
    const temp = Math.round(data.temperature);
    const description = getWeatherDescription(data.weathercode);
    const windspeed = data.windspeed;
    
    resultDiv.innerHTML = `
        <h3>${cityName}, ${countryName}</h3>
        <p>🌡️ Температура: <strong>${temp}°C</strong></p>
        <p>📝 Описание: ${description}</p>
        <p>💨 Скорость ветра: ${windspeed} м/с</p>
    `;
}


// =================================== 5. МОДУЛЬ: ФАКТЫ О КОШКАХ (Локальные данные) ===================================

function generateCatArticle() {
    // Используем корневой контейнер из HTML
    const resultContainer = document.getElementById('catResultContainer');
    
    if (!resultContainer) {
        console.error("Контейнер результатов для кошек не найден!");
        return;
    }

    // Показываем спиннер
    showSpinner(resultContainer);

    // Имитация задержки загрузки
    setTimeout(() => {
        // Получаем случайный факт
        const randomIndex = Math.floor(Math.random() * CAT_FACTS.length);
        const randomFact = CAT_FACTS[randomIndex];

        // Вставляем форматированный результат
        resultContainer.innerHTML = `
            <h3>Случайный факт №${randomIndex + 1}</h3>
            <p>${randomFact}</p>
            <p class="muted" style="margin-top: 10px;">Источник: Локальный массив данных.</p>
            <img src="https://via.placeholder.com/400x150?text=Cute+Cat" 
                 alt="Картинка кошки-заглушка" class="article-image">
        `;
    }, 500);
}


// =================================== 6. МОДУЛЬ: АССИСТЕНТ (Локальный, заглушечный режим) ===================================

function appendMessage(sender, text) {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    msgDiv.textContent = text;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function handleUserQuery(query) {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;

    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    appendMessage('assistant', '...размышляю...');
    const typingMessage = chatWindow.lastChild;

    setTimeout(() => {
        if (!chatWindow.contains(typingMessage)) return; 

        chatWindow.removeChild(typingMessage);
        
        let responseText;
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('имя')) {
            const userName = localStorage.getItem('userName') || 'Пользователь';
            responseText = `Ваше имя сохранено как "${userName}".`;
        } else if (lowerQuery.includes('погода')) {
            responseText = 'Чтобы узнать погоду, перейдите во вкладку "☁️ Погода".';
        } else if (lowerQuery.includes('кошк')) {
            responseText = 'Нажмите "Показать Случайный Факт" во вкладке "🐱 Факты о Кошках".';
        } else if (lowerQuery.includes('привет') || lowerQuery.includes('здравствуй')) {
            responseText = 'Привет! Я локальный ассистент, готовый помочь вам с навигацией.';
        } else if (lowerQuery.includes('тема')) {
            responseText = 'Вы можете переключить тёмную/светлую тему в разделе "👤 Профиль".';
        } else {
            responseText = `Спасибо за запрос "${query}". Я работаю в локальном режиме и могу отвечать только на простые команды (имя, погода, кошки, тема).`;
        }
        
        appendMessage('assistant', responseText);
    }, 800); 
}

function sendMessage() {
    const userInput = document.getElementById('userInput');
    if (!userInput) return;

    const query = userInput.value.trim();
    
    if (query === '') return;

    appendMessage('user', query);
    handleUserQuery(query);

    userInput.value = ''; 
}


// =================================== 7. ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛИ ===================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Загрузка настроек профиля при старте
    loadProfile();

    // 2. Слушатели для вкладок
    document.querySelectorAll('#tabs button').forEach(button => {
        button.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });
    
    // 3. Слушатели для Профиля/LocalStorage
    const userNameInput = document.getElementById('userName');
    if (userNameInput) userNameInput.addEventListener('input', saveProfile);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('change', saveProfile); 
    
    const avatarUploadInput = document.getElementById('avatarUpload');
    if(avatarUploadInput) {
        avatarUploadInput.addEventListener('change', handleAvatarUpload);
    }
    
    const saveProfileButton = document.getElementById('saveProfileButton');
    if (saveProfileButton) saveProfileButton.addEventListener('click', saveProfile); 
    
    const clearButton = document.getElementById('clearButton');
    if (clearButton) clearButton.addEventListener('click', clearAllData); 
    
    // 4. Слушатели для API Погоды
    const fetchWeatherButton = document.getElementById('fetchWeatherButton');
    if (fetchWeatherButton) fetchWeatherButton.addEventListener('click', fetchWeather);
    
    // 5. Слушатели для Фактов о Кошках
    const generateCatArticleButton = document.getElementById('generateCatArticleButton');
    if (generateCatArticleButton) generateCatArticleButton.addEventListener('click', generateCatArticle);
    
    // 6. Слушатели для Ассистента
    const sendMessageButton = document.getElementById('sendMessageButton');
    const userInput = document.getElementById('userInput');

    if (sendMessageButton) sendMessageButton.addEventListener('click', sendMessage);
    if (userInput) userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    switchTab('profile'); 
});