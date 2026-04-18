# 🧾 Script de Corrección Masiva RIPS (JSON + XML)

Este script recorre automáticamente las carpetas de meses (`ENERO`, `FEBRERO`, `MARZO`, `OCTUBRE`) y realiza correcciones sobre archivos **JSON** y **XML** sin alterar la estructura existente.

---

## 🚀 ¿Qué hace?

### 📌 1. Procesamiento de JSON

Para todos los `.json` encontrados en subcarpetas:

* Corrige `tipoDocumentoIdentificacion`:

  * Si está vacío → asigna `"CC"`
  * Si no coincide con la edad → lo ajusta (`TI` o `CC`)
* Completa en:

  * `consultas`
  * `procedimientos`
  * los campos:

    * `tipoDocumentoIdentificacion`
    * `numDocumentoIdentificacion`
* No modifica otros campos

---

### 📌 2. Procesamiento de XML

Para todos los `.xml`:

* Busca el bloque:

  ```xml
  <ctg:Collection schemeName="Usuario">
  ```
* Elimina TODOS los `CODIGO_PRESTADOR` existentes
* Inserta SOLO UNO válido:

  ```xml
  <ctg:AdditionalInformation>
    <ctg:Name>CODIGO_PRESTADOR</ctg:Name>
    <ctg:Value>1100127266</ctg:Value>
  </ctg:AdditionalInformation>
  ```
* Evita duplicados automáticamente

---

## 🔒 Seguridad

* Crea respaldo `.bak` antes de modificar:

  ```js
  const CREATE_BACKUP = true;
  ```

---

## 🧪 Modo prueba (opcional)

Puedes activar modo simulación:

```js
const DRY_RUN = true;
```

➡️ No guarda cambios, solo muestra lo que haría.

---

## 💾 Modo real

```js
const DRY_RUN = false;
```

➡️ Modifica directamente los archivos.

---

## 📁 Estructura esperada

```
RIPS ENE MARZO/
│
├── ENERO/
├── FEBRERO/
├── MARZO/
└── OCTUBRE/
    └── CAS XX/
        ├── archivo.xml
        └── archivo.json
```

---

## ▶️ Ejecución

```bash
node nombre-del-script.js
```

---

## ✅ Resultado

* JSON corregidos en sitio
* XML con un único `CODIGO_PRESTADOR`
* Logs detallados en consola
* Backups automáticos

---

## ⚠️ Nota

El script:

* NO elimina datos fuera de lo necesario
* NO cambia estructura
* SOLO corrige campos específicos

---
