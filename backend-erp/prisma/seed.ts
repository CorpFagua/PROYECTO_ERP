/**
 * prisma/seed.ts
 *
 * Seed completo del ERP:
 *  1.  Permisos + Roles (RBAC dinámico)
 *  2.  Geografía: provincias + localidades (leídas del dump)
 *  3.  Master data: cargos, sectores, tipos de producto
 *  4.  Sucursales, proveedores, canales de venta (leídos del dump)
 *  5.  Productos (leídos del dump)
 *  6.  Empleados (leídos del dump)
 *  7.  Usuarios — uno por empleado + 1 SUPER_ADMIN
 *  8.  Compras  (leídas del dump) + inicialización de stock
 *  9.  Ventas   (leídas del dump — históricas, sin FK a cliente/empleado)
 *
 * El dump se lee desde: ../../"24 marzo erpdatabase (1).txt"
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ─── MySQL dump parser ────────────────────────────────────────────────────────

const DUMP_PATH = path.resolve(
  __dirname,
  '../../24 marzo erpdatabase (1).txt'
);

type SqlValue = string | number | null;
type SqlRow = SqlValue[];

function loadDump(): string {
  if (!fs.existsSync(DUMP_PATH)) {
    throw new Error(`Dump no encontrado en: ${DUMP_PATH}`);
  }
  return fs.readFileSync(DUMP_PATH, "utf-8");
}

/**
 * Parsea el bloque VALUES de una o más sentencias
 * INSERT INTO `tableName` VALUES ...
 */
function getRows(dump: string, tableName: string): SqlRow[] {
  const re = new RegExp(
    `INSERT INTO \`${tableName}\` VALUES (.+)`,
    "gm"
  );
  const allRows: SqlRow[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(dump)) !== null) {
    allRows.push(...parseRows(m[1]));
  }

  return allRows;
}

function parseRows(block: string): SqlRow[] {
  const rows: SqlRow[] = [];
  let i = 0;
  const n = block.length;

  while (i < n) {
    // Find next row opening '('
    while (i < n && block[i] !== "(") i++;
    if (i >= n) break;
    i++; // skip '('

    const cols: SqlRow = [];

    rowLoop: while (i < n) {
      // skip whitespace
      while (i < n && block[i] === " ") i++;
      if (i >= n) break;

      const ch = block[i];

      if (ch === "'") {
        // ── String literal ───────────────────────────────────────
        i++;
        let s = "";
        while (i < n) {
          const c = block[i];
          if (c === "\\") {
            i++;
            if (i < n) { s += block[i]; i++; }
          } else if (c === "'") {
            i++;
            break;
          } else {
            s += c;
            i++;
          }
        }
        cols.push(s);
      } else if (block.startsWith("NULL", i)) {
        // ── NULL ─────────────────────────────────────────────────
        cols.push(null);
        i += 4;
      } else {
        // ── Number / date / bare word ─────────────────────────────
        let raw = "";
        while (i < n && block[i] !== "," && block[i] !== ")") {
          raw += block[i];
          i++;
        }
        const t = raw.trim();
        if (t === "") {
          // nothing
        } else if (/^-?\d+(\.\d+)?$/.test(t)) {
          cols.push(Number(t));
        } else {
          cols.push(t);
        }
      }

      // skip trailing whitespace
      while (i < n && block[i] === " ") i++;

      if (i >= n) break;
      if (block[i] === ",") { i++; continue; }
      if (block[i] === ")") { i++; break rowLoop; }
    }

    if (cols.length > 0) rows.push(cols);
  }

  return rows;
}

// ─── Normalización de strings para emails ────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function makeEmail(apellido: SqlValue, idEmpleado: number): string {
  const base = slugify(String(apellido ?? "emp"));
  return `${base || "emp"}.${idEmpleado}@erp.com`;
}

// ─── Asignación de rol según cargo y salario ─────────────────────────────────

function asignarRol(
  idCargo: number,
  salario: number,
  rolMap: Map<string, number>
): number {
  if (idCargo === 1) {
    return salario >= 40000
      ? rolMap.get("GERENTE")!
      : rolMap.get("ADMINISTRADOR")!;
  }
  if (idCargo === 2) return rolMap.get("OPERADOR")!;
  if (idCargo === 3 || idCargo === 4) return rolMap.get("TECNICO")!;
  if (idCargo === 5) return rolMap.get("VENDEDOR")!;
  return rolMap.get("OPERADOR")!;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Iniciando seed del ERP...\n");
  const dump = loadDump();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. RBAC: permisos
  // ═══════════════════════════════════════════════════════════════════════════

  const permisosDef = [
    // inventario
    { codigo: "inventario:ver",        modulo: "inventario",  accion: "ver" },
    { codigo: "inventario:crear",      modulo: "inventario",  accion: "crear" },
    { codigo: "inventario:editar",     modulo: "inventario",  accion: "editar" },
    { codigo: "inventario:eliminar",   modulo: "inventario",  accion: "eliminar" },
    // compras
    { codigo: "compras:ver",           modulo: "compras",     accion: "ver" },
    { codigo: "compras:crear",         modulo: "compras",     accion: "crear" },
    { codigo: "compras:aprobar",       modulo: "compras",     accion: "aprobar" },
    // ventas
    { codigo: "ventas:ver",            modulo: "ventas",      accion: "ver" },
    { codigo: "ventas:crear",          modulo: "ventas",      accion: "crear" },
    { codigo: "ventas:anular",         modulo: "ventas",      accion: "anular" },
    // proveedores
    { codigo: "proveedores:ver",       modulo: "proveedores", accion: "ver" },
    { codigo: "proveedores:gestionar", modulo: "proveedores", accion: "gestionar" },
    // sucursales
    { codigo: "sucursales:ver",        modulo: "sucursales",  accion: "ver" },
    { codigo: "sucursales:gestionar",  modulo: "sucursales",  accion: "gestionar" },
    // usuarios
    { codigo: "usuarios:ver",          modulo: "usuarios",    accion: "ver" },
    { codigo: "usuarios:gestionar",    modulo: "usuarios",    accion: "gestionar" },
    // reportes
    { codigo: "reportes:ver",          modulo: "reportes",    accion: "ver" },
    { codigo: "reportes:exportar",     modulo: "reportes",    accion: "exportar" },
    // anomalías
    { codigo: "anomalias:ver",         modulo: "anomalias",   accion: "ver" },
    { codigo: "anomalias:gestionar",   modulo: "anomalias",   accion: "gestionar" },
    // sistema
    { codigo: "sistema:configurar",    modulo: "sistema",     accion: "configurar" },
  ] as const;

  for (const p of permisosDef) {
    await prisma.permiso.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: p,
    });
  }

  const todosPermisos = await prisma.permiso.findMany();
  const pMap = new Map(todosPermisos.map((p) => [p.codigo, p.id]));
  console.log(`[1/9] ${todosPermisos.length} permisos`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. RBAC: roles
  // ═══════════════════════════════════════════════════════════════════════════

  const todosLosCodigos = permisosDef.map((p) => p.codigo);

  const rolesDef = [
    {
      nombre: "SUPER_ADMIN",
      descripcion: "Acceso total al sistema",
      permisos: todosLosCodigos,
    },
    {
      nombre: "ADMINISTRADOR",
      descripcion: "Administrador de operaciones",
      permisos: todosLosCodigos.filter((c) => c !== "sistema:configurar"),
    },
    {
      nombre: "GERENTE",
      descripcion: "Gerente de sucursal",
      permisos: [
        "inventario:ver",
        "compras:ver",
        "compras:aprobar",
        "ventas:ver",
        "ventas:anular",
        "proveedores:ver",
        "sucursales:ver",
        "usuarios:ver",
        "reportes:ver",
        "reportes:exportar",
        "anomalias:ver",
      ],
    },
    {
      nombre: "TECNICO",
      descripcion: "Técnico de inventario",
      permisos: [
        "inventario:ver",
        "inventario:crear",
        "inventario:editar",
        "compras:ver",
        "proveedores:ver",
        "sucursales:ver",
        "anomalias:ver",
      ],
    },
    {
      nombre: "VENDEDOR",
      descripcion: "Vendedor en sucursal",
      permisos: [
        "inventario:ver",
        "ventas:ver",
        "ventas:crear",
        "sucursales:ver",
      ],
    },
    {
      nombre: "OPERADOR",
      descripcion: "Operador administrativo",
      permisos: [
        "inventario:ver",
        "compras:ver",
        "ventas:ver",
        "proveedores:ver",
        "sucursales:ver",
        "reportes:ver",
      ],
    },
    {
      nombre: "AUDITOR",
      descripcion: "Solo lectura en todos los módulos",
      permisos: [
        "inventario:ver",
        "compras:ver",
        "ventas:ver",
        "proveedores:ver",
        "sucursales:ver",
        "usuarios:ver",
        "reportes:ver",
        "anomalias:ver",
      ],
    },
  ];

  const rolMap = new Map<string, number>();

  for (const r of rolesDef) {
    const rol = await prisma.rol.upsert({
      where: { nombre: r.nombre },
      update: {},
      create: { nombre: r.nombre, descripcion: r.descripcion },
    });
    rolMap.set(r.nombre, rol.id);

    for (const codigo of r.permisos) {
      const permisoId = pMap.get(codigo);
      if (!permisoId) continue;
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId } },
        update: {},
        create: { rolId: rol.id, permisoId },
      });
    }
  }

  console.log(`[2/9] ${rolesDef.length} roles con permisos asignados`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Geografía: provincias + localidades
  // ═══════════════════════════════════════════════════════════════════════════

  await prisma.provincia.createMany({
    data: [
      { id: 1, nombre: "Buenos Aires" },
      { id: 2, nombre: "Córdoba" },
      { id: 3, nombre: "Entre Ríos" },
      { id: 4, nombre: "Mendoza" },
      { id: 5, nombre: "Neuquén" },
      { id: 6, nombre: "Río Negro" },
      { id: 7, nombre: "Santa Fe" },
      { id: 8, nombre: "Sin Dato" },
      { id: 9, nombre: "Tucumán" },
    ],
    skipDuplicates: true,
  });

  const localRows = getRows(dump, "localidad");
  await prisma.localidad.createMany({
    data: localRows.map((r) => ({
      id:          r[0] as number,
      nombre:      r[1] as string,
      idProvincia: r[2] as number,
      latitud:     r[3] as number,
      longitud:    r[4] as number,
    })),
    skipDuplicates: true,
  });

  console.log(`[3/9] 9 provincias + ${localRows.length} localidades`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Master data: cargos, sectores, tipos de producto
  // ═══════════════════════════════════════════════════════════════════════════

  await prisma.cargo.createMany({
    data: [
      { id: 1, nombre: "Administrativo" },
      { id: 2, nombre: "Aux. Administrativo" },
      { id: 3, nombre: "Aux. Técnico" },
      { id: 4, nombre: "Técnico" },
      { id: 5, nombre: "Vendedor" },
    ],
    skipDuplicates: true,
  });

  await prisma.sector.createMany({
    data: [
      { id: 1, nombre: "Administración" },
      { id: 2, nombre: "Comunicación" },
      { id: 3, nombre: "Derecho" },
      { id: 4, nombre: "Diseño" },
      { id: 5, nombre: "Publicidad" },
      { id: 6, nombre: "Ventas" },
    ],
    skipDuplicates: true,
  });

  await prisma.tipoProducto.createMany({
    data: [
      { id: 1,  nombre: "Audio" },
      { id: 2,  nombre: "Bases" },
      { id: 3,  nombre: "Estucheria" },
      { id: 4,  nombre: "Gabinetes" },
      { id: 5,  nombre: "Gaming" },
      { id: 6,  nombre: "Grabacion" },
      { id: 7,  nombre: "Impresión" },
      { id: 8,  nombre: "Informatica" },
      { id: 9,  nombre: "Limpieza" },
      { id: 10, nombre: "Sin Dato" },
      { id: 11, nombre: "Varios" },
    ],
    skipDuplicates: true,
  });

  console.log("[4/9] 5 cargos + 6 sectores + 11 tipos de producto");

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Sucursales, proveedores, canales de venta
  // ═══════════════════════════════════════════════════════════════════════════

  const sucRows = getRows(dump, "sucursal");
  await prisma.sucursal.createMany({
    data: sucRows.map((r) => ({
      id:          r[0] as number,
      nombre:      r[1] as string,
      domicilio:   r[2] as string | null,
      idLocalidad: r[3] as number,
      latitud:     String(r[4]),
      longitud:    String(r[5]),
      activa:      true,
    })),
    skipDuplicates: true,
  });

  const provRows = getRows(dump, "proveedor");
  await prisma.proveedor.createMany({
    data: provRows.map((r) => ({
      id:          r[0] as number,
      nombre:      r[1] as string | null,
      domicilio:   r[2] as string | null,
      idLocalidad: r[3] as number,
    })),
    skipDuplicates: true,
  });

  await prisma.canalVenta.createMany({
    data: [
      { id: 1, canal: "Telefónico" },
      { id: 2, canal: "OnLine" },
      { id: 3, canal: "Presencial" },
    ],
    skipDuplicates: true,
  });

  console.log(
    `[5/9] ${sucRows.length} sucursales + ${provRows.length} proveedores + 3 canales`
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Productos
  // ═══════════════════════════════════════════════════════════════════════════

  const prodRows = getRows(dump, "producto");
  await prisma.producto.createMany({
    data: prodRows.map((r) => ({
      id:             r[0] as number,
      nombre:         r[1] as string,
      precio:         String(r[2]),
      idTipoProducto: r[3] as number,
      activo:         true,
    })),
    skipDuplicates: true,
  });

  console.log(`[6/9] ${prodRows.length} productos`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Empleados + Usuarios
  // ═══════════════════════════════════════════════════════════════════════════

  const empRows = getRows(dump, "empleado");
  await prisma.empleado.createMany({
    data: empRows.map((r) => ({
      id:             r[0] as number,   // IDEmpleado compuesto (sucursal + codigo)
      codigoEmpleado: r[1] as number,
      apellido:       r[2] as string | null,
      nombre:         r[3] as string | null,
      idSucursal:     r[4] as number,
      idSector:       r[5] as number,
      idCargo:        r[6] as number,
      salario:        String(r[7]),
    })),
    skipDuplicates: true,
  });

  // Hashes de contraseñas (generados una sola vez)
  const DEFAULT_PASS = await bcrypt.hash("erp2024",  12);
  const ADMIN_PASS   = await bcrypt.hash("admin2024", 12);

  // Super Admin manual
  await prisma.user.upsert({
    where: { email: "admin@erp.com" },
    update: {},
    create: {
      email:    "admin@erp.com",
      password: ADMIN_PASS,
      name:     "Administrador Sistema",
      rolId:    rolMap.get("SUPER_ADMIN")!,
    },
  });

  // Un usuario por empleado
  for (const r of empRows) {
    const id      = r[0] as number;
    const apellido = r[2] as string | null;
    const nombre   = r[3] as string | null;
    const idCargo  = r[6] as number;
    const salario  = r[7] as number;

    const email = makeEmail(apellido, id);
    const rolId = asignarRol(idCargo, salario, rolMap);

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password:   DEFAULT_PASS,
        name:       `${apellido ?? ""} ${nombre ?? ""}`.trim(),
        rolId,
        empleadoId: id,
      },
    });
  }

  console.log(`[7/9] ${empRows.length} empleados + ${empRows.length + 1} usuarios`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Compras + Stock inicial
  // ═══════════════════════════════════════════════════════════════════════════

  const compraRows = getRows(dump, "compra");

  if (compraRows.length > 0) {
    await prisma.compra.createMany({
      data: compraRows.map((r) => ({
        id:          r[0] as number,
        fecha:       new Date(r[1] as string),
        idProducto:  r[2] as number,
        cantidad:    r[3] as number,
        precio:      String(r[4]),
        idProveedor: r[5] as number,
      })),
      skipDuplicates: true,
    });

    // Calcular stock acumulado por producto en depósito central (sucursal 9)
    const DEPOSITO_ID = 9;
    const stockAcum = new Map<number, number>();
    for (const r of compraRows) {
      const idProd = r[2] as number;
      const qty    = r[3] as number;
      stockAcum.set(idProd, (stockAcum.get(idProd) ?? 0) + qty);
    }

    for (const [idProducto, cantidad] of stockAcum) {
      await prisma.stockLevel.upsert({
        where: { idProducto_idSucursal: { idProducto, idSucursal: DEPOSITO_ID } },
        update: { cantidad: { increment: cantidad } },
        create: { idProducto, idSucursal: DEPOSITO_ID, cantidad },
      });
    }

    console.log(
      `[8/9] ${compraRows.length} compras · ${stockAcum.size} stock levels @ sucursal ${DEPOSITO_ID}`
    );
  } else {
    console.log("[8/9] Sin compras en el dump");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Ventas históricas
  //    idCliente e idEmpleado se nullifican para evitar FK a datos no incluidos
  // ═══════════════════════════════════════════════════════════════════════════

  const ventaRows = getRows(dump, "venta");

  if (ventaRows.length > 0) {
    await prisma.venta.createMany({
      data: ventaRows.map((r) => ({
        id:           r[0] as number,
        fecha:        new Date(r[1] as string),
        fechaEntrega: new Date(r[2] as string),
        idCanal:      r[3] as number | null,
        idCliente:    null,                    // clientes no incluidos en seed
        idSucursal:   r[5] as number | null,
        idEmpleado:   null,                    // evita FK a empleados históricos no mapeados
        idProducto:   r[7] as number | null,
        precio:       String(r[8]),
        cantidad:     r[9] as number,
      })),
      skipDuplicates: true,
    });

    console.log(`[9/9] ${ventaRows.length} ventas históricas`);
  } else {
    console.log("[9/9] Sin ventas en el dump");
  }

  console.log("\nSeed completado correctamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
