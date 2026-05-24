import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "LaporPak API",
    version: "1.0.0",
    description: "Swagger documentation generated from route @swagger comments.",
  },
  servers: [
    {
      url: "/",
      description: "Current host",
    },
  ],
  tags: [
    { name: "Health", description: "Service health checks" },
    { name: "Auth", description: "Authentication and session routes" },
    { name: "Reports", description: "Citizen and agency report workflows" },
    { name: "Agencies", description: "Public agency data" },
    { name: "Categories", description: "Report categories" },
    { name: "Notifications", description: "User notification inbox" },
    { name: "Upload", description: "Object upload and streaming" },
    { name: "Admin", description: "Admin-only management routes" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Better Auth session cookie.",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
    parameters: {
      page: {
        name: "page",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, default: 1 },
      },
      limit: {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
      },
      reportStatus: {
        name: "status",
        in: "query",
        required: false,
        schema: {
          type: "string",
          enum: ["pending", "verified", "in_progress", "clarification_requested", "resolved", "rejected"],
        },
      },
      search: {
        name: "search",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
      kategoriId: {
        name: "kategoriId",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
      dinasId: {
        name: "dinasId",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
      cabangDinasId: {
        name: "cabangDinasId",
        in: "query",
        required: false,
        schema: { type: "string" },
      },
      id: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
    schemas: {
      ApiDataResponse: {
        type: "object",
        properties: {
          data: { nullable: true },
          stats: { type: "object", additionalProperties: true },
        },
      },
      ApiListResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { type: "object", additionalProperties: true } },
          meta: { $ref: "#/components/schemas/PaginationMeta" },
          stats: { type: "object", additionalProperties: true },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          take: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
          hasNextPage: { type: "boolean" },
          hasPrevPage: { type: "boolean" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          details: { type: "object", additionalProperties: true },
        },
      },
      HealthLiveResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      CreateReportMultipart: {
        type: "object",
        required: ["title", "description", "latitude", "longitude"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          kategoriId: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          images: { type: "array", items: { type: "string", format: "binary" }, maxItems: 5 },
        },
      },
      UpdateReportStatusMultipart: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["verified", "in_progress", "clarification_requested", "rejected"] },
          agencyNote: { type: "string" },
          catatanDinas: { type: "string" },
          resolutionNote: { type: "string" },
          images: { type: "array", items: { type: "string", format: "binary" }, maxItems: 5 },
        },
      },
      SubmitClarificationMultipart: {
        type: "object",
        required: ["note"],
        properties: {
          note: { type: "string" },
          clarificationNote: { type: "string" },
          images: { type: "array", items: { type: "string", format: "binary" }, maxItems: 5 },
        },
      },
      ResolveReportMultipart: {
        type: "object",
        required: ["resolutionImages"],
        properties: {
          resolutionNote: { type: "string" },
          agencyNote: { type: "string" },
          catatanDinas: { type: "string" },
          resolutionImages: { type: "array", items: { type: "string", format: "binary" }, maxItems: 5 },
        },
      },
      VoteReportInput: {
        type: "object",
        required: ["vote"],
        properties: { vote: { type: "integer", enum: [-1, 0, 1] } },
      },
      RateReportInput: {
        type: "object",
        required: ["score"],
        properties: {
          score: { type: "integer", minimum: 1, maximum: 5 },
          note: { type: "string" },
        },
      },
      UploadImageMultipart: {
        type: "object",
        required: ["image"],
        properties: { image: { type: "string", format: "binary" } },
      },
      DinasInput: {
        type: "object",
        properties: {
          code: { type: "string" },
          type: { type: "string" },
          name: { type: "string" },
          short: { type: "string" },
          wilayah: { type: "string" },
          description: { type: "string" },
          isActive: { type: "boolean" },
          routingPriority: { type: "number" },
        },
      },
      CabangInput: {
        type: "object",
        properties: {
          dinasId: { type: "string" },
          name: { type: "string" },
          wilayah: { type: "string" },
          address: { type: "string" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          phone: { type: "string" },
          province: { type: "string" },
          cityRegency: { type: "string" },
          coverageRadiusKm: { type: "number" },
          isRoutingEnabled: { type: "boolean" },
          serviceTags: { type: "array", items: { type: "string" } },
          photos: { type: "array", items: { type: "string" } },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      KategoriInput: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          slaHours: { type: "number" },
          urgencyWeight: { type: "number" },
          keywords: { type: "array", items: { type: "string" } },
          isActive: { type: "boolean" },
          dinasId: { type: "string" },
        },
      },
      AdminUserInput: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          role: { type: "string" },
          banned: { type: "boolean" },
          banReason: { type: "string" },
          banExpires: { type: "string", format: "date-time" },
        },
      },
      ResetPasswordInput: {
        type: "object",
        required: ["newPassword"],
        properties: { newPassword: { type: "string", format: "password" } },
      },
      AssignPetugasInput: {
        type: "object",
        required: ["cabangDinasId"],
        properties: {
          cabangDinasId: { type: "string" },
          nip: { type: "string" },
        },
      },
      AdminReportStatusInput: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["pending", "verified", "in_progress", "clarification_requested", "resolved", "rejected"],
          },
          agencyNote: { type: "string" },
          resolutionNote: { type: "string" },
        },
      },
      AssignLaporanInput: {
        type: "object",
        required: ["cabangDinasId"],
        properties: { cabangDinasId: { type: "string" } },
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: ["./src/**/*.routes.ts", "./src/app.ts", "./dist/**/*.routes.js", "./dist/app.js"],
});

export { swaggerUi };
