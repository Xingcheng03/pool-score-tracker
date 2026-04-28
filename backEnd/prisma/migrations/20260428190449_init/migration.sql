-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "playerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchName" TEXT NOT NULL,
    "dateISO" DATETIME NOT NULL,
    "raceTo" INTEGER NOT NULL,
    "leftPlayerId" TEXT NOT NULL,
    "rightPlayerId" TEXT NOT NULL,
    "leftScore" INTEGER NOT NULL,
    "rightScore" INTEGER NOT NULL,
    "winnerId" TEXT,
    "tag" TEXT NOT NULL DEFAULT 'PRACTICE',
    "isHandicap" BOOLEAN NOT NULL DEFAULT false,
    "handicapGiverId" TEXT,
    "handicapReceiverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_leftPlayerId_fkey" FOREIGN KEY ("leftPlayerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_rightPlayerId_fkey" FOREIGN KEY ("rightPlayerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_handicapGiverId_fkey" FOREIGN KEY ("handicapGiverId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_handicapReceiverId_fkey" FOREIGN KEY ("handicapReceiverId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchName" TEXT NOT NULL,
    "dateISO" DATETIME NOT NULL,
    "raceTo" INTEGER NOT NULL,
    "leftPlayerId" TEXT NOT NULL,
    "rightPlayerId" TEXT NOT NULL,
    "leftScore" INTEGER NOT NULL,
    "rightScore" INTEGER NOT NULL,
    "winnerId" TEXT,
    "tag" TEXT NOT NULL DEFAULT 'PRACTICE',
    "isHandicap" BOOLEAN NOT NULL DEFAULT false,
    "handicapGiverId" TEXT,
    "handicapReceiverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "approvedMatchId" TEXT,
    CONSTRAINT "MatchReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_leftPlayerId_fkey" FOREIGN KEY ("leftPlayerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_rightPlayerId_fkey" FOREIGN KEY ("rightPlayerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_handicapGiverId_fkey" FOREIGN KEY ("handicapGiverId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_handicapReceiverId_fkey" FOREIGN KEY ("handicapReceiverId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MatchReport_approvedMatchId_fkey" FOREIGN KEY ("approvedMatchId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_playerId_key" ON "User"("playerId");

-- CreateIndex
CREATE INDEX "Match_dateISO_idx" ON "Match"("dateISO");

-- CreateIndex
CREATE INDEX "Match_tag_idx" ON "Match"("tag");

-- CreateIndex
CREATE INDEX "Match_leftPlayerId_idx" ON "Match"("leftPlayerId");

-- CreateIndex
CREATE INDEX "Match_rightPlayerId_idx" ON "Match"("rightPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchReport_approvedMatchId_key" ON "MatchReport"("approvedMatchId");

-- CreateIndex
CREATE INDEX "MatchReport_status_idx" ON "MatchReport"("status");

-- CreateIndex
CREATE INDEX "MatchReport_submittedById_idx" ON "MatchReport"("submittedById");

-- CreateIndex
CREATE INDEX "MatchReport_dateISO_idx" ON "MatchReport"("dateISO");
