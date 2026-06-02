import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const timestamp = new Date();
  const clients = [
    {
      id: "client-001",
      name: "Acme Holdings",
      contactPerson: "Anita Rao",
      contactEmail: "anita.rao@acmeholdings.com",
      jurisdiction: "Singapore",
      serviceTier: "Enterprise",
      clientType: "Corporate",
      status: "in_progress",
      progressPercent: 48
    },
    {
      id: "client-002",
      name: "BluePeak Capital",
      contactPerson: "Omar Khan",
      contactEmail: "omar.khan@bluepeakcapital.com",
      jurisdiction: "UAE",
      serviceTier: "Professional",
      clientType: "SME",
      status: "blocked",
      progressPercent: 62
    },
    {
      id: "client-003",
      name: "Nexa Labs",
      contactPerson: "Priya Menon",
      contactEmail: "priya.menon@nexalabs.com",
      jurisdiction: "India",
      serviceTier: "Starter",
      clientType: "Startup",
      status: "completed",
      progressPercent: 100
    }
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      create: {
        ...client,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      update: {
        ...client,
        updatedAt: timestamp
      }
    });
  }

  await prisma.user.upsert({
    where: { email: "user@example.com" },
    create: {
      id: "user-63a7105692",
      email: "user@example.com",
      name: "Demo User",
      passwordHash: await bcrypt.hash(process.env.DEMO_USER_PASSWORD ?? "password", 12),
      roles: "user",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    update: {}
  });

  await prisma.activity.upsert({
    where: { id: "act-1" },
    create: {
      id: "act-1",
      clientId: "client-001",
      title: "Document uploaded",
      description: "Acme Holdings uploaded passport verification.",
      createdAt: timestamp,
      type: "upload"
    },
    update: {}
  });
  await prisma.activity.upsert({
    where: { id: "act-2" },
    create: {
      id: "act-2",
      clientId: "client-002",
      title: "Workflow blocked",
      description: "BluePeak Capital is missing compliance declaration.",
      createdAt: timestamp,
      type: "status_change"
    },
    update: {}
  });

  await prisma.document.upsert({
    where: { id: "doc-1" },
    create: {
      id: "doc-1",
      clientId: "client-001",
      stepKey: "identity",
      fileName: "passport.pdf",
      fileSize: 1_200_000,
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: timestamp
    },
    update: {}
  });

  await prisma.onboardingProgress.upsert({
    where: { clientId: "client-001" },
    create: {
      id: "onboarding-client-001",
      clientId: "client-001",
      status: "in_progress",
      progressPercent: 48,
      currentStep: "financial_documents",
      startedAt: timestamp,
      updatedAt: timestamp,
      completedSteps: {
        create: [
          { id: "step-client-001-identity", stepKey: "identity", completedAt: timestamp },
          {
            id: "step-client-001-company",
            stepKey: "company_documents",
            completedAt: timestamp
          }
        ]
      }
    },
    update: {
      status: "in_progress",
      progressPercent: 48,
      currentStep: "financial_documents",
      updatedAt: timestamp
    }
  });

  await prisma.cRMRecord.upsert({
    where: { clientId: "client-001" },
    create: {
      crmId: "crm-client-001",
      clientId: "client-001",
      companyName: "Acme Holdings",
      plan: "enterprise",
      createdBy: "seed",
      createdAt: timestamp
    },
    update: {}
  });

  await prisma.dataRoom.upsert({
    where: { clientId: "client-001" },
    create: {
      roomId: "room-client-001",
      clientId: "client-001",
      createdAt: timestamp
    },
    update: {}
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
