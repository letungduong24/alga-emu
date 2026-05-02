import { Router, Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Game } from "../entity/Game";
import { ILike } from "typeorm";

const router = Router();
const repo = () => AppDataSource.getRepository(Game);

// GET /api/games?q=pokemon&page=1&limit=20&platform=nds
router.get("/", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const platform = (req.query.platform as string) || "nds";

    const where: any = { platform };
    if (q.trim()) {
      where.name = ILike(`%${q.trim()}%`);
    }

    const [games, total] = await repo().findAndCount({
      where,
      order: { name: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      games,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const game = await repo().findOneBy({ id: parseInt(req.params.id as string) });
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
