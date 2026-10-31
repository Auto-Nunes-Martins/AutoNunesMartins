import { createContactBudgetStore } from './lib/server/contactBudget.js';
import { contactBudgetDatabase } from './lib/server/contactBudgetDatabase.js';
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createPublicContactRouter } from './routes/publicContact.js';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { getEnv } from './env.js';
import { logger } from './logger.js';
import { clerkMiddleware, requireUser, type AuthedRequest } from './middleware/clerk.js';
import clerkWebhookRouter from './routes/webhooks/clerk.js';
import vehiclesRouter from './routes/vehicles.js';
import publicVehiclesRouter from './routes/publicVehicles.js';
import homepageHighlightsRouter from './routes/homepageHighlights.js';
import vehicleWebPublicationRouter from './routes/vehicleWebPublication.js';
import vehicleStatsRouter from './routes/vehicleStats.js';
import vehicleExpensesRouter from './routes/vehicleExpenses.js';
import vehiclePhotosRouter from './routes/vehiclePhotos.js';
import customersRouter from './routes/customers.js';
import salesRouter from './routes/sales.js';
import tasksRouter from './routes/tasks.js';
import taskStatsRouter from './routes/taskStats.js';
import usersRouter from './routes/users.js';
import dashboardRouter from './routes/dashboard.js';
import dashboardTasksRouter from './routes/dashboardTasks.js';
import featuredVehicleRouter from './routes/featuredVehicle.js';
import operationalExpensesRouter from './routes/operationalExpenses.js';
import settingsRouter from './routes/settings.js';
import notificationsRouter from './routes/notifications.js';
import activityRouter from './routes/activity.js';
import diagnosticsRouter from './routes/diagnostics.js';
import searchRouter from './routes/search.js';
import { contactErrorHandler, errorHandler } from './middleware/errorHandler.js';
import { requestTiming, timedMiddleware } from './middleware/requestTiming.js';
import { prisma, runtimeDatabasePoolLimit } from './db.js';
import { requestDiagnostics } from './middleware/requestDiagnostics.js';

const env = getEnv();
export const app = express();
app.use(requestDiagnostics);
app.use(requestTiming(env.NODE_ENV === 'development'));

app.use(helmet());
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    ...(env.NODE_ENV === 'development' ? { databasePoolLimit: runtimeDatabasePoolLimit } : {}),
  });
});
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
// No request logger on this route: contact payloads and relay headers remain private.
app.use(
  '/api/public/contact',
  express.json({ limit: '16kb' }),
  createPublicContactRouter(
    {
      enabled: env.CONTACT_ENABLED === 'true',
      apiKey: env.RESEND_API_KEY,
      from: env.CONTACT_FROM_EMAIL,
      to: env.CONTACT_TO_EMAIL,
      relaySecret: env.CONTACT_RELAY_SECRET,
    },
    fetch,
    createContactBudgetStore(contactBudgetDatabase(prisma), env.CONTACT_RELAY_SECRET ?? '', {
      daily: env.CONTACT_DAILY_LIMIT,
      monthly: env.CONTACT_MONTHLY_LIMIT,
    }),
  ),
);
app.use('/api/public/contact', contactErrorHandler);
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(pinoHttp({ logger }));
app.use(
  '/webhooks/clerk',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    (req as Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
    next();
  },
  clerkWebhookRouter,
);
const jsonBody = express.json({ limit: '1mb' });
app.use((req, res, next) => {
  if (req.method === 'POST' && /^\/api\/vehicles\/[^/]+\/photos\/?$/.test(req.path)) next();
  else jsonBody(req, res, next);
});
// Public read-only projection bypasses authenticated CRM auto-provisioning.
app.use('/api/public/vehicles', publicVehiclesRouter);
app.use(timedMiddleware('backend-clerk', clerkMiddleware));
app.use('/api/diagnostics', diagnosticsRouter);
app.get('/api/me', requireUser, (req: AuthedRequest, res: Response) => {
  res.json({ user: req.user });
});

// Stats router is mounted first so its /stats route resolves before
// vehiclesRouter would treat "stats" as an :id path param.
app.use('/api/vehicles', vehicleStatsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/vehicles', vehicleWebPublicationRouter);
app.use('/api/vehicles/:vehicleId/photos', vehiclePhotosRouter);
app.use('/api/vehicle-expenses', vehicleExpensesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/sales', salesRouter);
// Stats first so /stats resolves before tasks router's /:id route.
app.use('/api/tasks', taskStatsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/dashboard', dashboardTasksRouter);
app.use('/api/dashboard', featuredVehicleRouter);
app.use('/api/operational-expenses', operationalExpensesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/homepage-highlights', homepageHighlightsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/search', searchRouter);

app.use(errorHandler);
