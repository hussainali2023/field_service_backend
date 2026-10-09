import bcrypt from "bcryptjs";
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
  Role,
  UrgencyLevel,
  UserStatus,
} from "./generated/prisma/enums";
import prisma from "../src/lib/prisma";

async function seed() {
  console.log("Starting database seeding for Field Service Management System...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.requestStatusLog.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.service.deleteMany();
  await prisma.technicianProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log("Cleared existing data.");

  // Password hashes
  const adminPassword = await bcrypt.hash("Admin@12345", 10);
  const techPassword = await bcrypt.hash("Tech@12345", 10);
  const custPassword = await bcrypt.hash("Cust@12345", 10);

  // 1. Seed Admin
  const admin = await prisma.user.create({
    data: {
      name: "System Administrator",
      email: "admin@fieldservice.com",
      password: adminPassword,
      phone: "+1-555-0100",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log("Seeded Admin: admin@fieldservice.com / Admin@12345");

  // 2. Seed Technicians
  const techUser1 = await prisma.user.create({
    data: {
      name: "Alex Rivera",
      email: "technician@fieldservice.com",
      password: techPassword,
      phone: "+1-555-0201",
      role: Role.TECHNICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  const techProfile1 = await prisma.technicianProfile.create({
    data: {
      userId: techUser1.id,
      skills: ["HVAC", "Electrical", "Smart Thermostats"],
      experienceYears: 8,
      hourlyRate: 65.0,
      serviceArea: "Metro North & Downtown",
      bio: "Certified master HVAC & electrical specialist with 8 years of residential and commercial field service experience.",
      rating: 4.9,
      reviewCount: 1,
      isAvailable: true,
    },
  });
  console.log("Seeded Technician 1: technician@fieldservice.com / Tech@12345");

  const techUser2 = await prisma.user.create({
    data: {
      name: "Sarah Jenkins",
      email: "sarah.tech@fieldservice.com",
      password: techPassword,
      phone: "+1-555-0202",
      role: Role.TECHNICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.technicianProfile.create({
    data: {
      userId: techUser2.id,
      skills: ["Plumbing", "Water Heaters", "Pipe Leak Detection"],
      experienceYears: 5,
      hourlyRate: 55.0,
      serviceArea: "Downtown & Eastside",
      bio: "Licensed master plumber specializing in rapid leak repairs and water heater maintenance.",
      rating: 5.0,
      reviewCount: 0,
      isAvailable: true,
    },
  });
  console.log("Seeded Technician 2: sarah.tech@fieldservice.com / Tech@12345");

  // 3. Seed Customers
  const customer1 = await prisma.user.create({
    data: {
      name: "John Doe",
      email: "customer@fieldservice.com",
      password: custPassword,
      phone: "+1-555-0301",
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });
  console.log("Seeded Customer 1: customer@fieldservice.com / Cust@12345");

  const customer2 = await prisma.user.create({
    data: {
      name: "Emily Clark",
      email: "emily@fieldservice.com",
      password: custPassword,
      phone: "+1-555-0302",
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });
  console.log("Seeded Customer 2: emily@fieldservice.com / Cust@12345");

  // 4. Seed Services
  const hvacService = await prisma.service.create({
    data: {
      name: "Central AC Diagnostic & Repair",
      description: "Complete inspection of AC compressor, refrigerant check, airflow testing, and fast malfunction fix.",
      category: "HVAC",
      basePrice: 120.0,
      estimatedDurationHours: 2.5,
      isAvailable: true,
    },
  });

  const plumbingService = await prisma.service.create({
    data: {
      name: "Emergency Pipe Leak Repair",
      description: "Rapid on-site pipe leak detection, burst pipe replacement, and high-pressure sealing.",
      category: "Plumbing",
      basePrice: 95.0,
      estimatedDurationHours: 1.5,
      isAvailable: true,
    },
  });

  const electricalService = await prisma.service.create({
    data: {
      name: "Electrical Panel & Circuit Upgrade",
      description: "Safe 200A panel upgrades, circuit breaker replacements, and surge protection installations.",
      category: "Electrical",
      basePrice: 180.0,
      estimatedDurationHours: 3.0,
      isAvailable: true,
    },
  });

  const smartHomeService = await prisma.service.create({
    data: {
      name: "Smart Thermostat Installation",
      description: "Installation and Wi-Fi configuration for Nest, Ecobee, or Honeywell smart climate systems.",
      category: "Smart Home",
      basePrice: 85.0,
      estimatedDurationHours: 1.0,
      isAvailable: true,
    },
  });

  console.log("Seeded 4 core service catalog offerings.");

  // 5. Seed Service Requests & Lifecycle Workflows
  // Case A: Completed Work Order with Invoice, Stripe Payment, and Customer Review
  const req1 = await prisma.serviceRequest.create({
    data: {
      requestNumber: "SR-1001",
      customerId: customer1.id,
      serviceId: hvacService.id,
      technicianId: techProfile1.id,
      title: "AC blowing warm air in living room",
      description: "The main condenser turns on but the airflow is warm. Needs urgent diagnostic before heatwave.",
      address: "742 Evergreen Terrace, Sector 4",
      urgency: UrgencyLevel.HIGH,
      status: RequestStatus.COMPLETED,
      preferredDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      scheduledEndDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2.5 * 3600 * 1000),
      estimatedPrice: 120.0,
      finalPrice: 145.0,
      adminNotes: "Customer prioritized due to senior citizen on premises.",
      serviceReport: "Diagnosed blown capacitor and low refrigerant level. Replaced capacitor (35/5 uF) and recharged 1.5 lbs R-410A. System blowing at 54°F.",
      partsUsed: "1x Dual Run Capacitor 35/5uF 440V, R-410A Refrigerant",
    },
  });

  await prisma.requestStatusLog.createMany({
    data: [
      {
        serviceRequestId: req1.id,
        toStatus: RequestStatus.REQUESTED,
        changedByUserId: customer1.id,
        notes: "Request submitted by customer",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        serviceRequestId: req1.id,
        fromStatus: RequestStatus.REQUESTED,
        toStatus: RequestStatus.REVIEWED,
        changedByUserId: admin.id,
        notes: "Reviewed and approved by dispatcher",
        createdAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
      },
      {
        serviceRequestId: req1.id,
        fromStatus: RequestStatus.REVIEWED,
        toStatus: RequestStatus.SCHEDULED,
        changedByUserId: admin.id,
        notes: "Assigned to Alex Rivera",
        createdAt: new Date(Date.now() - 2.2 * 24 * 60 * 60 * 1000),
      },
      {
        serviceRequestId: req1.id,
        fromStatus: RequestStatus.SCHEDULED,
        toStatus: RequestStatus.COMPLETED,
        changedByUserId: techUser1.id,
        notes: "Work completed successfully and tested",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2.5 * 3600 * 1000),
      },
    ],
  });

  // Invoice for Request 1
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-1001",
      serviceRequestId: req1.id,
      amount: 145.0,
      tax: 14.5,
      totalAmount: 159.5,
      status: InvoiceStatus.PAID,
      paidAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
    },
  });

  // Payment for Invoice 1
  await prisma.payment.create({
    data: {
      invoiceId: inv1.id,
      amount: 159.5,
      method: PaymentMethod.STRIPE,
      status: PaymentStatus.COMPLETED,
      transactionId: "cs_test_mock_seed_completed_1001",
      stripePaymentIntentId: "pi_test_mock_1001",
      paidAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
    },
  });

  // Review for Request 1
  await prisma.review.create({
    data: {
      serviceRequestId: req1.id,
      customerId: customer1.id,
      technicianId: techProfile1.id,
      rating: 5,
      comment: "Alex arrived on time, was extremely professional, and diagnosed the problem in 15 minutes! Fantastic service.",
    },
  });

  // Case B: Scheduled Work Order (Active)
  const req2 = await prisma.serviceRequest.create({
    data: {
      requestNumber: "SR-1002",
      customerId: customer2.id,
      serviceId: plumbingService.id,
      technicianId: techProfile1.id,
      title: "Burst pipe under kitchen sink",
      description: "Severe water leak under the double sink cabinet. Main valve shut off temporarily.",
      address: "104 Baker Street, Apt 3B",
      urgency: UrgencyLevel.HIGH,
      status: RequestStatus.SCHEDULED,
      preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000 + 1.5 * 3600 * 1000),
      estimatedPrice: 95.0,
      adminNotes: "Dispatch confirmed technician has appropriate PEX crimp fittings.",
    },
  });

  await prisma.requestStatusLog.createMany({
    data: [
      {
        serviceRequestId: req2.id,
        toStatus: RequestStatus.REQUESTED,
        changedByUserId: customer2.id,
        notes: "Request submitted by Emily Clark",
      },
      {
        serviceRequestId: req2.id,
        fromStatus: RequestStatus.REQUESTED,
        toStatus: RequestStatus.SCHEDULED,
        changedByUserId: admin.id,
        notes: "Reviewed and scheduled with Alex Rivera",
      },
    ],
  });

  // Case C: Newly Requested Work Order (Awaiting Review)
  await prisma.serviceRequest.create({
    data: {
      requestNumber: "SR-1003",
      customerId: customer1.id,
      serviceId: smartHomeService.id,
      title: "Install Google Nest Thermostat 3rd Gen",
      description: "Need wiring adapter installed for C-wire and connection to dual-zone boiler.",
      address: "742 Evergreen Terrace, Sector 4",
      urgency: UrgencyLevel.LOW,
      status: RequestStatus.REQUESTED,
      preferredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      estimatedPrice: 85.0,
    },
  });

  console.log("Seeded realistic service requests, status logs, invoices, payments, and reviews.");
  console.log("Database seeding completed successfully!");
}

seed()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
