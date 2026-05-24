import { Router } from "express";

import {
  assignAdminLaporanController,
  assignPetugasToUserController,
  createCabangController,
  createDinasController,
  createKategoriController,
  deleteAdminLaporanController,
  deleteCabangController,
  deleteDinasController,
  deleteKategoriController,
  getAdminLaporanDetailController,
  getAdminOverviewController,
  getAdminUserDetailController,
  listAdminCabangController,
  listAdminDinasController,
  listAdminKategoriController,
  listAdminLaporanController,
  listAdminUsersController,
  removePetugasFromUserController,
  resetAdminUserPasswordController,
  updateAdminLaporanStatusController,
  updateAdminUserController,
  updateCabangController,
  updateDinasController,
  updateKategoriController,
} from "./admin.controller.js";
import { requireAdminRole, requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth, requireAdminRole);

/**
 * @swagger
 * /api/admin/overview:
 *   get:
 *     tags: [Admin]
 *     summary: Get admin overview
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin overview
 *       403:
 *         description: Admin role required
 *
 * /api/admin/dinas:
 *   get:
 *     tags: [Admin]
 *     summary: List dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - name: isActive
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Dinas list
 *   post:
 *     tags: [Admin]
 *     summary: Create dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/DinasInput"
 *     responses:
 *       201:
 *         description: Dinas created
 *       409:
 *         description: Kode dinas already exists
 *
 * /api/admin/dinas/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/DinasInput"
 *     responses:
 *       200:
 *         description: Dinas updated
 *       404:
 *         description: Dinas not found
 *   delete:
 *     tags: [Admin]
 *     summary: Delete dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Dinas deleted
 *       400:
 *         description: Dinas still has related data
 *
 * /api/admin/cabang:
 *   get:
 *     tags: [Admin]
 *     summary: List cabang dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - $ref: "#/components/parameters/dinasId"
 *       - name: wilayah
 *         in: query
 *         schema:
 *           type: string
 *       - name: cityRegency
 *         in: query
 *         schema:
 *           type: string
 *       - name: isRoutingEnabled
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Cabang list
 *   post:
 *     tags: [Admin]
 *     summary: Create cabang dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CabangInput"
 *     responses:
 *       201:
 *         description: Cabang created
 *       404:
 *         description: Dinas not found
 *
 * /api/admin/cabang/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update cabang dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CabangInput"
 *     responses:
 *       200:
 *         description: Cabang updated
 *       404:
 *         description: Cabang not found
 *   delete:
 *     tags: [Admin]
 *     summary: Delete cabang dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Cabang deleted
 *       400:
 *         description: Cabang still has related data
 *
 * /api/admin/kategori:
 *   get:
 *     tags: [Admin]
 *     summary: List kategori
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - $ref: "#/components/parameters/dinasId"
 *       - name: isActive
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Kategori list
 *   post:
 *     tags: [Admin]
 *     summary: Create kategori
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/KategoriInput"
 *     responses:
 *       201:
 *         description: Kategori created
 *       409:
 *         description: Kode kategori already exists
 *
 * /api/admin/kategori/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update kategori
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/KategoriInput"
 *     responses:
 *       200:
 *         description: Kategori updated
 *       404:
 *         description: Kategori not found
 *   delete:
 *     tags: [Admin]
 *     summary: Delete kategori
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Kategori deleted
 *       400:
 *         description: Kategori already used by reports
 *
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *       - name: banned
 *         in: query
 *         schema:
 *           type: boolean
 *       - name: hasPetugas
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: User list
 *
 * /api/admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user detail
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: User detail
 *       404:
 *         description: User not found
 *   patch:
 *     tags: [Admin]
 *     summary: Update user
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AdminUserInput"
 *     responses:
 *       200:
 *         description: User updated
 *       409:
 *         description: Email already used
 *
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     tags: [Admin]
 *     summary: Reset user password
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ResetPasswordInput"
 *     responses:
 *       200:
 *         description: Password reset
 *
 * /api/admin/users/{id}/assign-petugas:
 *   post:
 *     tags: [Admin]
 *     summary: Assign petugas profile to user
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AssignPetugasInput"
 *     responses:
 *       200:
 *         description: Petugas assigned
 *   delete:
 *     tags: [Admin]
 *     summary: Remove petugas profile from user
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Petugas removed
 *
 * /api/admin/laporan:
 *   get:
 *     tags: [Admin]
 *     summary: List reports for admin
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - $ref: "#/components/parameters/reportStatus"
 *       - $ref: "#/components/parameters/dinasId"
 *       - $ref: "#/components/parameters/cabangDinasId"
 *       - $ref: "#/components/parameters/kategoriId"
 *     responses:
 *       200:
 *         description: Admin report list
 *
 * /api/admin/laporan/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get admin report detail
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Admin report detail
 *       404:
 *         description: Report not found
 *   delete:
 *     tags: [Admin]
 *     summary: Delete report
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Report deleted
 *
 * /api/admin/laporan/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update report status as admin
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AdminReportStatusInput"
 *     responses:
 *       200:
 *         description: Report status updated
 *
 * /api/admin/laporan/{id}/assign:
 *   patch:
 *     tags: [Admin]
 *     summary: Assign report to cabang dinas
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AssignLaporanInput"
 *     responses:
 *       200:
 *         description: Report assigned
 */
router.get("/overview", asyncHandler(getAdminOverviewController));

router.get("/dinas", asyncHandler(listAdminDinasController));
router.post("/dinas", asyncHandler(createDinasController));
router.patch("/dinas/:id", asyncHandler(updateDinasController));
router.delete("/dinas/:id", asyncHandler(deleteDinasController));

router.get("/cabang", asyncHandler(listAdminCabangController));
router.post("/cabang", asyncHandler(createCabangController));
router.patch("/cabang/:id", asyncHandler(updateCabangController));
router.delete("/cabang/:id", asyncHandler(deleteCabangController));

router.get("/kategori", asyncHandler(listAdminKategoriController));
router.post("/kategori", asyncHandler(createKategoriController));
router.patch("/kategori/:id", asyncHandler(updateKategoriController));
router.delete("/kategori/:id", asyncHandler(deleteKategoriController));

router.get("/users", asyncHandler(listAdminUsersController));
router.get("/users/:id", asyncHandler(getAdminUserDetailController));
router.patch("/users/:id", asyncHandler(updateAdminUserController));
router.post("/users/:id/reset-password", asyncHandler(resetAdminUserPasswordController));
router.post("/users/:id/assign-petugas", asyncHandler(assignPetugasToUserController));
router.delete("/users/:id/assign-petugas", asyncHandler(removePetugasFromUserController));

router.get("/laporan", asyncHandler(listAdminLaporanController));
router.get("/laporan/:id", asyncHandler(getAdminLaporanDetailController));
router.patch("/laporan/:id/status", asyncHandler(updateAdminLaporanStatusController));
router.patch("/laporan/:id/assign", asyncHandler(assignAdminLaporanController));
router.delete("/laporan/:id", asyncHandler(deleteAdminLaporanController));

export default router;
