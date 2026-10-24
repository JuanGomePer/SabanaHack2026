import { Router } from 'express';
import { mapaRouter } from './mapa.js';
import { plantasRouter } from './plantas.js';
import { hallazgosRouter } from './hallazgos.js';
import { alertasRouter } from './alertas.js';
import { registroRouter } from './registro.js';
import { configuracionRouter } from './configuracion.js';
import { equiposRouter } from './equipos.js';
import { fotosRouter } from './fotos.js';
import { eventosRouter } from './eventos.js';
import { demoRouter } from './demo.js';
import { observacionesRouter } from './observaciones.js';
import { smsRouter } from './sms.js';

export const apiRouter = Router();

apiRouter.use(mapaRouter);
apiRouter.use(plantasRouter);
apiRouter.use(hallazgosRouter);
apiRouter.use(alertasRouter);
apiRouter.use(registroRouter);
apiRouter.use(configuracionRouter);
apiRouter.use(equiposRouter);
apiRouter.use(fotosRouter);
apiRouter.use(eventosRouter);
apiRouter.use(demoRouter);
apiRouter.use(observacionesRouter);
apiRouter.use(smsRouter);
