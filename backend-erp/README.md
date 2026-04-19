# Backend ERP

API REST construida con **Express + TypeScript + Prisma + PostgreSQL**.

## Estructura

```
src/
├── config/env.ts                     # Variables de entorno tipadas
├── lib/prisma.ts                     # Singleton Prisma Client
├── middleware/
│   ├── auth.ts                       # JWT authentication + authorization
│   └── errorHandler.ts               # Error handling global (Zod + AppError)
├── modules/
│   ├── auth/                         # Registro, login, perfil
│   ├── inventory/                    # Productos, bodegas, movimientos, stock
│   └── immune-system/                # Sistema Inmunológico Artificial
│       └── detectors/                # Detectores de anomalías
│           ├── base-detector.ts      # Interfaz AnomalyDetector
│           ├── stock-threshold.detector.ts
│           └── unusual-movement.detector.ts
├── routes/index.ts                   # Agregador de rutas
├── app.ts                            # Configuración Express
└── server.ts                         # Entry point
```

## Scripts

```bash
npm run dev              # Desarrollo con hot reload (tsx watch)
npm run build            # Compilar TypeScript
npm start                # Producción (requiere build previo)
npm run prisma:migrate   # Ejecutar migraciones
npm run prisma:generate  # Generar Prisma Client
npm run prisma:studio    # UI visual de la base de datos
```

## Variables de entorno

Ver `.env.example` para la lista completa.
