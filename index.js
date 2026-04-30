const fs = require("fs");
const path = require("path");

// ===== CONFIG =====
const ROOT_DIR = "C:/Users/Developer/Desktop/RIPS";
const MONTHS = ["ENERO", "FEBRERO", "MARZO", "OCTUBRE","DICIEMBRE"];

const DRY_RUN = false;
const CREATE_BACKUP = false;

// ===== XML / CODIGO_PRESTADOR =====
const PRESTADOR_VALUE = "1100127266";
const INSERT_BLOCK =
    `<ctg:AdditionalInformation><ctg:Name>CODIGO_PRESTADOR</ctg:Name><ctg:Value>${PRESTADOR_VALUE}</ctg:Value></ctg:AdditionalInformation>`;

// ===== HELPERS GENERALES =====
function valorVacio(v) {
    return v === undefined || v === null || String(v).trim() === "";
}

function parseFechaSolo(fechaStr) {
    if (!fechaStr) return null;

    const parte = String(fechaStr).split(" ")[0].split("T")[0];
    const match = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return null;

    const f = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(f.getTime()) ? null : f;
}

function calcularEdad(fecha) {
    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();

    if (
        hoy.getMonth() < fecha.getMonth() ||
        (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())
    ) {
        edad--;
    }

    return edad;
}

function tipoPorEdad(edad) {
    return edad < 18 ? "TI" : "CC";
}

function agregarTipoEnOrden(usuario) {
    if (!valorVacio(usuario.tipoDocumentoIdentificacion)) {
        return usuario;
    }

    const nuevo = {};

    for (const key of Object.keys(usuario)) {
        if (key === "numDocumentoIdentificacion") {
            nuevo.tipoDocumentoIdentificacion = "CC";
        }
        nuevo[key] = usuario[key];
    }

    if (!("tipoDocumentoIdentificacion" in nuevo)) {
        return {
            tipoDocumentoIdentificacion: "CC",
            ...usuario
        };
    }

    return nuevo;
}

function obtenerArchivosRecursivos(dir, extension) {
    const resultados = [];

    if (!fs.existsSync(dir)) return resultados;

    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const rutaCompleta = path.join(dir, item.name);

        if (item.isDirectory()) {
            resultados.push(...obtenerArchivosRecursivos(rutaCompleta, extension));
        } else if (item.isFile() && item.name.toLowerCase().endsWith(extension.toLowerCase())) {
            resultados.push(rutaCompleta);
        }
    }

    return resultados;
}

function crearBackupSiAplica(filePath) {
    if (!CREATE_BACKUP || DRY_RUN) return;

    const backupPath = filePath + ".bak";
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
    }
}

// ===== JSON =====
function procesarJson(jsonPath) {
    let data;

    try {
        data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (error) {
        console.log(`❌ Error leyendo JSON: ${jsonPath}`);
        console.log(`   Motivo: ${error.message}`);
        return { ok: false, usuariosFix: 0, serviciosFix: 0 };
    }

    if (!Array.isArray(data.usuarios)) {
        console.log(`⚠️  Archivo sin arreglo 'usuarios': ${jsonPath}`);
        return { ok: false, usuariosFix: 0, serviciosFix: 0 };
    }

    let usuariosFix = 0;
    let serviciosFix = 0;
    let huboCambios = false;

    console.log(`\n📂 JSON: ${jsonPath}`);

    data.usuarios.forEach((usuarioOriginal, i) => {
        let usuario = usuarioOriginal;
        const cambiosUsuario = [];

        // 1) Asegurar tipoDocumentoIdentificacion si viene vacío
        if (valorVacio(usuario.tipoDocumentoIdentificacion)) {
            data.usuarios[i] = agregarTipoEnOrden(usuario);
            usuario = data.usuarios[i];
            cambiosUsuario.push("tipoDocumentoIdentificacion = CC");
            usuariosFix++;
            huboCambios = true;
        }

        // 2) Corregir tipo por edad
        const fecha = parseFechaSolo(usuario.fechaNacimiento);
        if (fecha) {
            const edad = calcularEdad(fecha);
            const esperado = tipoPorEdad(edad);

            if (
                (usuario.tipoDocumentoIdentificacion === "CC" ||
                    usuario.tipoDocumentoIdentificacion === "TI") &&
                usuario.tipoDocumentoIdentificacion !== esperado
            ) {
                cambiosUsuario.push(
                    `tipoDocumentoIdentificacion: ${usuario.tipoDocumentoIdentificacion} -> ${esperado}`
                );
                usuario.tipoDocumentoIdentificacion = esperado;
                usuariosFix++;
                huboCambios = true;
            }
        }

        const tipo = usuario.tipoDocumentoIdentificacion;
        const num = usuario.numDocumentoIdentificacion;

        if (cambiosUsuario.length > 0) {
            console.log(`   👤 Usuario[${i}] ${num || "(sin documento)"}`);
            cambiosUsuario.forEach(cambio => {
                console.log(`      🔧 ${cambio}`);
            });
        }

        const consultas = usuario?.servicios?.consultas || [];
        const procedimientos = usuario?.servicios?.procedimientos || [];

        // 3) Completar consultas
        consultas.forEach((c, ic) => {
            const cambios = [];

            if (valorVacio(c.tipoDocumentoIdentificacion)) {
                c.tipoDocumentoIdentificacion = tipo;
                cambios.push("tipoDocumentoIdentificacion");
            }

            if (valorVacio(c.numDocumentoIdentificacion)) {
                c.numDocumentoIdentificacion = num;
                cambios.push("numDocumentoIdentificacion");
            }

            if (cambios.length > 0) {
                serviciosFix++;
                huboCambios = true;
                console.log(`      🏥 Consulta[${ic}] -> ${cambios.join(", ")}`);
            }
        });

        // 4) Completar procedimientos
        procedimientos.forEach((p, ip) => {
            const cambios = [];

            if (valorVacio(p.tipoDocumentoIdentificacion)) {
                p.tipoDocumentoIdentificacion = tipo;
                cambios.push("tipoDocumentoIdentificacion");
            }

            if (valorVacio(p.numDocumentoIdentificacion)) {
                p.numDocumentoIdentificacion = num;
                cambios.push("numDocumentoIdentificacion");
            }

            if (cambios.length > 0) {
                serviciosFix++;
                huboCambios = true;
                console.log(`      ⚙️  Procedimiento[${ip}] -> ${cambios.join(", ")}`);
            }
        });
    });

    if (!huboCambios) {
        console.log(`   ✅ Sin cambios`);
        return { ok: true, usuariosFix: 0, serviciosFix: 0 };
    }

    if (!DRY_RUN) {
        crearBackupSiAplica(jsonPath);
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
        console.log(`   💾 JSON guardado`);
    } else {
        console.log(`   🧪 DRY RUN: no se guardaron cambios`);
    }

    console.log(`   ✔ Usuarios corregidos: ${usuariosFix}`);
    console.log(`   ✔ Servicios corregidos: ${serviciosFix}`);

    return { ok: true, usuariosFix, serviciosFix };
}

// ===== XML =====
function procesarXml(xmlPath) {
    let content;

    try {
        content = fs.readFileSync(xmlPath, "utf8");
    } catch (error) {
        console.log(`❌ Error leyendo XML: ${xmlPath}`);
        console.log(`   Motivo: ${error.message}`);
        return { ok: false, fixed: 0, alreadyOk: 0, collectionNotFound: 0 };
    }

    const collectionRegex =
        /(<ctg:Collection[^>]*schemeName\s*=\s*["']Usuario["'][^>]*>)([\s\S]*?)(<\/ctg:Collection>)/i;

    const match = content.match(collectionRegex);

    if (!match) {
        console.log(`⚠️  XML sin bloque Usuario: ${xmlPath}`);
        return { ok: false, fixed: 0, alreadyOk: 0, collectionNotFound: 1 };
    }

    const openingTag = match[1];
    let innerContent = match[2];
    const closingTag = match[3];

    // Borrar TODOS los bloques CODIGO_PRESTADOR previos
    innerContent = innerContent.replace(
        /<ctg:AdditionalInformation>[\s\S]*?<ctg:Name>\s*CODIGO_PRESTADOR\s*<\/ctg:Name>[\s\S]*?<\/ctg:AdditionalInformation>/gi,
        ""
    );

    // Insertar SOLO UNO al inicio
    const newCollection = `${openingTag}${INSERT_BLOCK}${innerContent}${closingTag}`;
    const oldCollection = match[0];

    if (oldCollection === newCollection) {
        console.log(`   ✅ XML ya correcto: ${xmlPath}`);
        return { ok: true, fixed: 0, alreadyOk: 1, collectionNotFound: 0 };
    }

    const newContent = content.replace(oldCollection, newCollection);

    if (!DRY_RUN) {
        crearBackupSiAplica(xmlPath);
        fs.writeFileSync(xmlPath, newContent, "utf8");
        console.log(`   💾 XML corregido: ${xmlPath}`);
    } else {
        console.log(`   🧪 DRY RUN XML: se corregiría ${xmlPath}`);
    }

    return { ok: true, fixed: 1, alreadyOk: 0, collectionNotFound: 0 };
}

// ===== MAIN =====
function main() {
    let totalJson = 0;
    let totalJsonOk = 0;
    let totalJsonError = 0;
    let totalUsuariosFix = 0;
    let totalServiciosFix = 0;

    let totalXml = 0;
    let totalXmlOk = 0;
    let totalXmlError = 0;
    let totalXmlFixed = 0;
    let totalXmlAlreadyOk = 0;
    let totalXmlCollectionNotFound = 0;

    console.log("========================================");
    console.log("INICIO DE PROCESO");
    console.log("========================================");
    console.log(`ROOT_DIR: ${ROOT_DIR}`);
    console.log(`MONTHS: ${MONTHS.join(", ")}`);
    console.log(`DRY_RUN: ${DRY_RUN}`);
    console.log(`CREATE_BACKUP: ${CREATE_BACKUP}`);
    console.log("========================================");

    for (const month of MONTHS) {
        const monthPath = path.join(ROOT_DIR, month);

        if (!fs.existsSync(monthPath)) {
            console.log(`\n⚠️  No existe la carpeta: ${monthPath}`);
            continue;
        }

        console.log(`\n==================================================`);
        console.log(`📁 MES: ${month}`);
        console.log(`==================================================`);

        const jsonFiles = obtenerArchivosRecursivos(monthPath, ".json");
        const xmlFiles = obtenerArchivosRecursivos(monthPath, ".xml");

        console.log(`JSON encontrados: ${jsonFiles.length}`);
        console.log(`XML encontrados: ${xmlFiles.length}`);

        totalJson += jsonFiles.length;
        totalXml += xmlFiles.length;

        // ===== JSON =====
        for (const jsonFile of jsonFiles) {
            const res = procesarJson(jsonFile);

            if (res.ok) {
                totalJsonOk++;
                totalUsuariosFix += res.usuariosFix;
                totalServiciosFix += res.serviciosFix;
            } else {
                totalJsonError++;
            }
        }

        // ===== XML =====
        for (const xmlFile of xmlFiles) {
            const res = procesarXml(xmlFile);

            if (res.ok) {
                totalXmlOk++;
                totalXmlFixed += res.fixed;
                totalXmlAlreadyOk += res.alreadyOk;
                totalXmlCollectionNotFound += res.collectionNotFound;
            } else {
                totalXmlError++;
                totalXmlCollectionNotFound += res.collectionNotFound || 0;
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`RESUMEN FINAL`);
    console.log(`========================================`);
    console.log(`JSON encontrados: ${totalJson}`);
    console.log(`JSON procesados OK: ${totalJsonOk}`);
    console.log(`JSON con error: ${totalJsonError}`);
    console.log(`Usuarios corregidos: ${totalUsuariosFix}`);
    console.log(`Servicios corregidos: ${totalServiciosFix}`);
    console.log(`----------------------------------------`);
    console.log(`XML encontrados: ${totalXml}`);
    console.log(`XML procesados OK: ${totalXmlOk}`);
    console.log(`XML con error: ${totalXmlError}`);
    console.log(`XML corregidos CODIGO_PRESTADOR: ${totalXmlFixed}`);
    console.log(`XML ya correctos: ${totalXmlAlreadyOk}`);
    console.log(`XML sin bloque Usuario: ${totalXmlCollectionNotFound}`);
    console.log(`----------------------------------------`);
    console.log(`Modo: ${DRY_RUN ? "DRY RUN" : "ESCRITURA REAL"}`);
    console.log(`Backup .bak: ${CREATE_BACKUP ? "SI" : "NO"}`);
    console.log(`========================================\n`);
}

main();