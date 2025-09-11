import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { middleware } from "./middleware.js";
import  { CreateUserSchema, SigninSchema, CreateRoomSchema, JoinRoomSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// Health check endpoint for Kubernetes
app.get("/health", (req, res) => {
    res.status(200).json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        service: "http-backend"
    });
});

// app.use(cors({
//   origin: "http://localhost:3000",  // frontend origin
//   credentials: true,
//   allowedHeaders: ["Content-Type", "Authorization"]
// }));

app.post("/signup", async (req, res) => {
    console.log("inside the signup wendpioint")
    const parsedData = CreateUserSchema.safeParse(req.body);
    if (!parsedData.success) {
        console.log(parsedData.error);
        const errors = parsedData.error.errors.reduce((acc, error) => {
            const key = error.path[0] ?? "unknown";
            acc[key] = error.message;
            return acc;
        }, {} as Record<string, string>);
        
        res.status(400).json({
            message: "Validation failed",
            errors
        });
        return;
    }
    
    try {
        const user = await prismaClient.user.create({
            data: {
                email: parsedData.data.email,
                // TODO: Hash the pw
                password: parsedData.data.password,
                name: parsedData.data.name
            }
        });
        
        // Return JWT token directly from signup
        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET);
        
        res.json({
            userId: user.id,
            token,
            message: "Account created successfully"
        });
    } catch(e) {
        res.status(411).json({
            message: "User already exists with this email"
        });
    }
});

app.post("/signin", async (req, res) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
        const errors = parsedData.error.errors.reduce((acc, error) => {
            const key = error.path[0] ?? "unknown";
            acc[key] = error.message;

            return acc;
        }, {} as Record<string, string>);
        
        res.status(400).json({
            message: "Validation failed",
            errors
        });
        return;
    }

    // TODO: Compare the hashed pws here
    const user = await prismaClient.user.findFirst({
        where: {
            email: parsedData.data.email,
            password: parsedData.data.password
        }
    });

    if (!user) {
        res.status(403).json({
            message: "Invalid email or password"
        });
        return;
    }

    const token = jwt.sign({
        userId: user.id
    }, JWT_SECRET);
    
    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name
        }
    });
});

app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        const errors = parsedData.error.errors.reduce((acc, error) => {
            const key = error.path[0] ?? "unknown";
            acc[key] = error.message;
            return acc;
        }, {} as Record<string, string>);
        
        res.status(400).json({
            message: "Validation failed",
            errors
        });
        return;
    }
    
    // @ts-ignore: TODO: Fix this
    const userId = req.userId;

    try {
        const room = await prismaClient.room.create({
            data: {
                slug: parsedData.data.name,
                password: parsedData.data.password || null,
                adminId: userId
            }
        });

        res.json({
            roomId: room.id,
            roomSlug: room.slug
        });
    } catch(e) {
        res.status(411).json({
            message: "Room already exists with this name"
        });
    }
});

app.post("/room/join", middleware, async (req, res) => {
    const parsedData = JoinRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        const errors = parsedData.error.errors.reduce((acc, error) => {
            const key = error.path[0] ?? "unknown";
            acc[key] = error.message;
            return acc;
        }, {} as Record<string, string>);
        
        res.status(400).json({
            message: "Validation failed",
            errors
        });
        return;
    }

    try {
        const room = await prismaClient.room.findFirst({
            where: {
                slug: parsedData.data.name
            }
        });

        if (!room) {
            res.status(404).json({
                message: "Room not found"
            });
            return;
        }

        // Check password if room has one
        if (room.password && room.password !== parsedData.data.password) {
            res.status(403).json({
                message: "Incorrect room password"
            });
            return;
        }

        res.json({
            roomId: room.id,
            roomSlug: room.slug
        });
    } catch(e) {
        console.error(e);
        res.status(500).json({
            message: "Failed to join room"
        });
    }
});

app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        
        if (isNaN(roomId)) {
            res.status(400).json({
                message: "Invalid room ID"
            });
            return;
        }
        
        const messages = await prismaClient.chat.findMany({
            where: {
                roomId: roomId
            },
            orderBy: {
                id: "asc"
            },
            take: 1000
        });

        res.json({
            messages
        });
    } catch(e) {
        console.log(e);
        res.json({
            messages: []
        });
    }
});

app.get("/room/:roomSlug", async (req, res) => {
    const roomSlug = req.params.roomSlug;
    const room = await prismaClient.room.findFirst({
        where: {
            slug: roomSlug
        },
        include: {
            admin: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });

    if (!room) {
        res.status(404).json({
            message: "Room not found"
        });
        return;
    }

    res.json({
        room
    });
});

const PORT =Number(process.env.PORT) || 3001;
app.listen(PORT,'0.0.0.0', () => {
    console.log(`HTTP Backend running on port ${PORT}`);
});