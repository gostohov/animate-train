let graphTrajectories;
let isAnimating = false;

// Флаг для отслеживания состояния звука
let isMuted = false;

document.addEventListener("DOMContentLoaded", () => {
    openWelcomePopup();

    gsap.registerPlugin(MotionPathPlugin);
    const trajectories = Array.from(document.querySelectorAll("[data-type='trajectory']")).map(el => {
        return {
            start: el.dataset.start,
            end: el.dataset.end,
            id: el.id
        }
    });

    graphTrajectories = buildGraph(trajectories);  
    
    document.querySelectorAll("[data-type='city']").forEach(el => {
        el.addEventListener("click", () => {
            if (isAnimating) {
                return;
            }

            openPopup(el);

            const cityId = el.id;
            const train = document.getElementById('train');
            const startCityId = parseInt(train.getAttribute('data-current-position'));
            if (cityId == startCityId) {
                return;
            }

            moveTo(el);
        });
    });

    // Получаем элемент с иконкой аудио
    const audioToggleEl = document.getElementById('audio-toggle');
    // Добавляем обработчик на иконку аудио для управления звуком
    audioToggleEl.addEventListener('click', toggleSound);

    const infoWelcomePopupBtnEl = document.getElementById('info-btn');
    infoWelcomePopupBtnEl.addEventListener('click', openWelcomePopup);
});

const moveTo = (destinationCityEl) => {
    const destinationCityId = destinationCityEl.id;

    // Получаем элемент поезда
    const train = document.getElementById('train');
    const startCityId = parseInt(train.getAttribute('data-current-position'));

    if (destinationCityId === startCityId) {
        return;
    }

    const pathIds = findPath(graphTrajectories, startCityId, destinationCityId);
    if (!pathIds?.length) {
        return;
    }

    // Создаем GSAP timeline для последовательной анимации движения поезда по каждому пути
    const timeline = gsap.timeline({
        onStart: () => {
            // Устанавливаем флаг для предотвращения новых анимаций
            isAnimating = true;

            // заменяем иконки городов
            const startCityEl = document.getElementById(startCityId);
            markCityAsPristine(startCityEl);
            markCityAsTouched(destinationCityEl);

            const popupFooterPrevButtonEl = document.querySelector('.btn-prev');
            const popupFooterNextButtonEl = document.querySelector(".btn-next");
            popupFooterPrevButtonEl.classList.add('disabled');
            popupFooterNextButtonEl.classList.add('disabled');
        },
        onComplete: () => {
            // Сбрасываем флаг после завершения всей анимации
            isAnimating = false;

            const prevCityId = destinationCityEl.dataset.prevcity;
            const popupFooterPrevButtonEl = document.querySelector('.btn-prev');
            if (prevCityId !== undefined && popupFooterPrevButtonEl) {
                popupFooterPrevButtonEl.classList.remove('disabled');
            }
            const nextCityId = destinationCityEl.dataset.nextcity;
            const popupFooterNextButtonEl = document.querySelector(".btn-next");
            if (nextCityId !== undefined && popupFooterNextButtonEl) {
                popupFooterNextButtonEl.classList.remove('disabled');
            }
        },
        onUpdate: () => {
            centerScrollOnTrain();
            setSoundVolume();
        }
    });

    pathIds.forEach((pathId, index) => {
        const endPoints = pathId.split("-");
        const start = parseInt(endPoints[0]);
        const end = parseInt(endPoints[1]);
        const isMovingBackward = (start > end || (start === 0 && end === 1)) && !(start === 1 && end === 0);

        // Добавляем анимацию для каждого пути в последовательность
        const path = document.getElementById(pathId);
        timeline.to(train, {
            duration: 3, // Время для перехода по данному пути
            ease: "none",
            motionPath: {
                path: path, // Указываем путь для анимации
                align: path, // Совмещение объекта по пути
                alignOrigin: [0.5, 0.5],
                autoRotate: true,    // Автоматический поворот по направлению движения
                start: isMovingBackward ? 1 : 0, // Параметры для обратного движения
                end: isMovingBackward ? 0 : 1
            },
            onStart: () => {
                if (pathIds.length - 1 == index) {
                    // Воспроизведение звука остановки, на последнем участке
                    playTrainStopSound();
                } else {
                    // Воспроизводим звук движения поезда при старте анимации
                    playTrainMoveSound();
                }

                // Обновляем позицию поезда в начале каждой анимации
                train.setAttribute('data-current-position', end);

                // Меняем изображение поезда в зависимости от направления движения
                if (isMovingBackward) {
                    train.setAttribute('href', 'assets/img/train_reverse.svg');
                } else {
                    train.setAttribute('href', 'assets/img/train.svg');
                }
            }
        });
    });

    // Запускаем анимацию
    timeline.play();
};

const markCityAsPristine = (cityElement) => {
    const currentHref = cityElement.getAttribute('href');
    const newHref = currentHref.replace(/(assets\/img\/)([^\/]+)_красный(\.svg)/, '$1$2$3');
    cityElement.setAttribute('href', newHref);
};

const markCityAsTouched = (cityElement) => {
    const currentHref = cityElement.getAttribute('href');
    const newHref = currentHref.replace(/(assets\/img\/)([^\/]+)(\.svg)/, '$1$2_красный$3');
    cityElement.setAttribute('href', newHref);
};

const findPath = (graph, start, end, path = [], visited = new Set()) => {
    if (start === end) {
        return path;
    }

    start = `${start}`;
    end = `${end}`;

    if (visited.has(start)) {
        return null;
    }

    visited.add(start);

    const neighbors = graph.get(start) || [];
    for (const { end: neighbor, id } of neighbors) {
        if (!path.includes(id)) {
            const result = findPath(graph, neighbor, end, [...path, id], visited);
            if (result) {
                return result;
            }
        }
    }

    visited.delete(start);
    return null;
}

const buildGraph = (trajectories) => {
    const graph = new Map();

    trajectories.forEach(({ start, end, id }) => {
        if (!graph.has(start)) {
            graph.set(start, []);
        }
        graph.get(start).push({ end, id });
    });

    return graph;
}

const centerScrollOnTrain = () => {
    const train = document.getElementById('train');
    train.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
};

const openPopup = (cityElement) => {
    closePopup();

    const containerEl = document.querySelector(".container");

    // Создаем элемент попапа
    const popupEl = document.createElement('div');
    popupEl.classList.add('popup-container');

    // Наполняем попап содержимым
    popupEl.innerHTML = `
        <div class="popup-content">
            <button class="btn-close"><i class="fa fa-times fa-lg" aria-hidden="true"></i></button>
            <div class="popup-header">
                <h1>${cityElement.dataset.cityname}</h1>
            </div>
            <div class="popup-body">
                <figure>
                    <img src="${cityElement.dataset.imagepath1}" alt="Изображение города">
                    <figcaption>${cityElement.dataset.caption1}</figcaption></br>
                    <img src="${cityElement.dataset.imagepath2}" alt="Изображение города" onerror="this.style.display='none';">
                    <figcaption>${cityElement.dataset.caption2}</figcaption>
                </figure>
                <p>${cityElement.dataset.description}</p>
            </div>
        </div>
        <div class="popup-footer">
            <button class="btn-prev">Предыдущая станция</button>
            <button class="btn-next">Следующая станция</button>
        </div>
    `;

    // Добавляем к контейнеру стили
    containerEl.classList.add('popup-opened');
    // Добавляем попап в контейнер
    containerEl.appendChild(popupEl);

    // Добавляем callback на кнопку закрытия попапа
    document.querySelector(".btn-close").addEventListener("click", () => closePopup());

    const btnPrevEl = document.querySelector(".btn-prev");
    const prevCityId = cityElement.dataset.prevcity;
    if (prevCityId !== undefined) {
        btnPrevEl.classList.remove('disabled');
        btnPrevEl.addEventListener("click", () => {
            const prevCityEl = document.getElementById(prevCityId);
            openPopup(prevCityEl);
            moveTo(prevCityEl);
        });
    } else {
        btnPrevEl.classList.add('disabled');
    }

    const btnNextEl = document.querySelector(".btn-next");
    const nextCityId = cityElement.dataset.nextcity;
    if (nextCityId !== undefined) {
        btnNextEl.classList.remove('disabled');
        btnNextEl.addEventListener("click", () => {
            const nextCityEl = document.getElementById(nextCityId);
            openPopup(nextCityEl);
            moveTo(nextCityEl);
        });
    } else {
        btnNextEl.classList.add('disabled');
    }
}

const closePopup = () => {
    // Находим элемент попапа
    const popupEl = document.querySelector(".popup-container");

    // Если попап найден, удаляем его
    if (popupEl) {
        popupEl.remove();
        const containerEl = document.querySelector(".container");
        containerEl.classList.remove('popup-opened');
    }
}

const playAudio = (audioId) => {
    const audioElement = document.getElementById(audioId);
    if (audioElement) {
        audioElement.currentTime = 0; // Сброс времени воспроизведения на начало
        audioElement.play().catch(error => {
            console.error("Ошибка при воспроизведении аудио:", error);
        });
    }
};

// Воспроизведение звука движения поезда
const playTrainMoveSound = () => {
    playAudio('train-audio-edet');
};

// Воспроизведение звука остановки поезда
const playTrainStopSound = () => {
    playAudio('train-audio-ostanovka');
};

// Функция для переключения звука и смены иконки
const toggleSound = () => {
    isMuted = !isMuted;
    toggleSoundIcon();
    setSoundVolume();
};

const setSoundVolume = () => {
    const audioEdet = document.getElementById('train-audio-edet');
    const audioOstanovka = document.getElementById('train-audio-ostanovka');

    // Переключаем громкость аудио
    if (!audioEdet.paused) {
        audioEdet.volume = !isMuted ? 1 : 0;
    }
    if (!audioOstanovka.paused) {
        audioOstanovka.volume = !isMuted ? 1 : 0;
    }
}

const toggleSoundIcon = () => {
    // Получаем элемент с иконкой аудио
    const audioToggleEl = document.getElementById('audio-toggle');
    // Меняем иконку
    if (isMuted) {
        audioToggleEl.setAttribute('href', 'assets/img/audio_unmute.svg');
    } else {
        audioToggleEl.setAttribute('href', 'assets/img/audio_mute.svg');
    }
}

const openWelcomePopup = () => {
    const containerEl = document.querySelector(".container");

    // Создаем элемент попапа
    const popupEl = document.createElement('div');
    popupEl.classList.add('welcome-popup-container');

    // Наполняем попап содержимым
    popupEl.innerHTML = `
        <div class="welcome-popup-wrapper">
            <div class="welcome-popup">
                <h1 class="welcome-popup-header">Искусство БАМа</h1>
                <div class="welcome-popup-description">БАМ — одна из крупнейших железных дорог мира, которую возводили миллионы человек на протяжении десятилетия. Такой масштабный проект оставил после себя и огромный культурный пласт. Здесь мы расскажем об истории строительства, жизни и труде рабочих в непростых условиях в архивных фотографиях и картинах от самих строителей магистрали.</div>
                <h2 class="welcome-popup-header">Инструкция:</h2>
                <i class="welcome-popup-instruction">Для того, чтобы перемещаться между станциями и узнать их историю, нажми на название станции или точку на карте, и поезд поедет по указанному маршруту. Звуковое сопровождение на сайте можно отключить, нажав на иконку звука.</i>
                <button class="welcome-popup-btn clickable">Поехали</button>
            </div>
        </div>
    `;

    // Добавляем попап в контейнер
    containerEl.appendChild(popupEl);

    const welcomePopupBtnEl = document.querySelector('.welcome-popup-btn');
    welcomePopupBtnEl.addEventListener('click', closeWelcomePopup);
};

const closeWelcomePopup = () => {
    // Находим элемент попапа
    const popupEl = document.querySelector(".welcome-popup-container");
    // Если попап найден, удаляем его
    if (popupEl) {
        popupEl.remove();
    }
};