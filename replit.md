# UltraProgol · Liga MX

## Descripción
Página profesional y moderna de Progol para la Liga MX. Muestra la tabla de posiciones, goleadores, calendario y permite armar una quiniela Progol con datos en tiempo real de la API UltraGol.

## Tech Stack
- **Runtime:** Node.js 20
- **Servidor:** Built-in `http` module (sin dependencias externas)
- **Frontend:** HTML + CSS + JavaScript puro (Vanilla JS)
- **API:** https://ultragol-api-3.vercel.app

## Estructura del Proyecto
```
/
├── Index.js          → Servidor HTTP que sirve archivos estáticos (puerto 5000)
├── vercel.json       → Configuración para despliegue en Vercel
├── public/
│   ├── index.html    → Página principal SPA
│   ├── css/
│   │   └── style.css → Estilos modernos dark theme
│   └── js/
│       └── app.js    → Lógica de la app + llamadas a la API
└── replit.md         → Este archivo
```

## Funcionalidades
- **Progol:** Selecciona 1/X/2 para cada partido y guarda tu quiniela
- **Tabla:** Tabla general con zonas de liguilla, repechaje y descenso
- **Goleadores:** Top anotadores del torneo con ranking visual
- **Calendario:** Partidos agrupados por jornada con marcadores

## Endpoints de la API usados
- `/tabla` → Tabla de posiciones Liga MX
- `/goleadores` → Tabla de goleadores
- `/calendario` → Partidos del calendario

## Despliegue
- **Local (Replit):** `node Index.js` en puerto 5000
- **Vercel:** Configurado con `vercel.json` usando `@vercel/node`
