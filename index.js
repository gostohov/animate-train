let graphTrajectories;
let isAnimating = false;

document.addEventListener("DOMContentLoaded", () => {
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
        el.addEventListener("click", () => moveTo(el));
    });
});

const moveTo = (element) => {
    if (isAnimating) {
        // Если анимация уже идёт, игнорируем новое действие
        return;
    }

    const destination = element.id;

    // Получаем элемент поезда
    const train = document.getElementById('train');
    const currentPosition = parseInt(train.getAttribute('data-current-position'));

    if (destination === currentPosition) {
        return;
    }

    const pathIds = findPath(graphTrajectories, currentPosition, destination);
    if (!pathIds?.length) {
        return;
    }

    // Устанавливаем флаг для предотвращения новых анимаций
    isAnimating = true;

    // Создаем GSAP timeline для последовательной анимации движения поезда по каждому пути
    const timeline = gsap.timeline({
        onComplete: () => {
            isAnimating = false; // Сбрасываем флаг после завершения всей анимации
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
            duration: 1, // Время для перехода по данному пути
            ease: "none",
            motionPath: {
                path: path, // Указываем путь для анимации
                align: path, // Совмещение объекта по пути
                alignOrigin: [0.5, 0.5],
                autoRotate: true,    // Автоматический поворот по направлению движения
                start: isMovingBackward ? 1 : 0, // Параметры для обратного движения
                end: isMovingBackward ? 0 : 1,
                curviness: 2,
                type: "cubic"
            },
            onStart: () => {
                // Обновляем позицию поезда в начале каждой анимации
                train.setAttribute('data-current-position', end);

                // Меняем изображение поезда в зависимости от направления движения
                if (isMovingBackward) {
                    train.setAttribute('href', 'assets/train_reverse.svg');
                } else {
                    train.setAttribute('href', 'assets/train.svg');
                }

                // Центрируем вьюпорт на поезде
                centerScrollOnTrain();
            },
            onComplete: () => {
                // Центрируем вьюпорт на поезде
                centerScrollOnTrain();
            }
        });
    });

    // Запускаем анимацию
    timeline.play();
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
    const trainBBox = train.getBoundingClientRect();
    const scrollX = trainBBox.left + window.scrollX - (window.innerWidth / 2 - trainBBox.width / 2);
    const scrollY = trainBBox.top + window.scrollY - (window.innerHeight / 2 - trainBBox.height / 2);

    window.scrollTo({
        top: scrollY,
        left: scrollX,
        behavior: 'smooth'
    });
};