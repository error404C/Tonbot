import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import adsRouter from "./ads";
import withdrawalsRouter from "./withdrawals";
import leaderboardRouter from "./leaderboard";
import settingsRouter from "./settings";
import tasksRouter from "./tasks";
import referralsRouter from "./referrals";
import adminRouter from "./admin";
import channelsRouter from "./channels";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(adsRouter);
router.use(withdrawalsRouter);
router.use(leaderboardRouter);
router.use(settingsRouter);
router.use(tasksRouter);
router.use(referralsRouter);
router.use(adminRouter);
router.use(channelsRouter);

export default router;
