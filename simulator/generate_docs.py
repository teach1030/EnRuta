"""
Generador del Documento Académico Formal en formato Microsoft Word (.docx)
para la entrega al docente en la Actividad 9 - Curso: Ingeniería Aplicada (Universidad Libre).

Proyecto: EnRuta - Sistema Inteligente de Optimización de Rutas de Última Milla (Bogotá D.C.)
Autores: Juan Esteban Guerrero Vera, Santiago Casas Barreto, Jose Sebastian Villalba
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    """Establece el color de fondo de una celda en formato HEX (ej: '065F46')."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    """Establece los márgenes internos (padding) de una celda en dxa."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_callout_borders(cell, border_hex="065F46"):
    """Crea un borde izquierdo grueso para cajas de llamada / notas."""
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="36" w:space="0" w:color="{border_hex}"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

def set_table_borders(table, border_hex="CBD5E1"):
    """Aplica bordes suaves y elegantes a una tabla."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{border_hex}"/>'
        f'<w:left w:val="none"/>'
        f'<w:bottom w:val="single" w:sz="12" w:space="0" w:color="{border_hex}"/>'
        f'<w:right w:val="none"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_hex}"/>'
        f'<w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def add_callout(doc, text, title="NOTA METODOLÓGICA", border_hex="065F46", bg_hex="F0FDF4"):
    """Agrega un cuadro destacado de texto tipo callout."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    
    cell = table.rows[0].cells[0]
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    set_callout_borders(cell, border_hex=border_hex)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    
    run_title = p.add_run(f"📌 {title}: ")
    run_title.bold = True
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(10)
    run_title.font.color.rgb = RGBColor(6, 95, 70)
    
    run_text = p.add_run(text)
    run_text.font.name = "Calibri"
    run_text.font.size = Pt(9.5)
    run_text.font.color.rgb = RGBColor(30, 41, 59)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(4)

def add_formula_box(doc, formula_str, explanation=""):
    """Agrega un bloque destacado con fondo gris claro para fórmulas matemáticas."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    
    cell = table.rows[0].cells[0]
    set_cell_background(cell, "F8FAFC")
    set_cell_margins(cell, top=100, bottom=100, left=180, right=180)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="E2E8F0"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="0EA5E9"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="E2E8F0"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="E2E8F0"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(3)
    
    run_f = p.add_run(formula_str)
    run_f.font.name = "Cambria Math"
    run_f.font.size = Pt(11)
    run_f.bold = True
    run_f.font.color.rgb = RGBColor(15, 23, 42)
    
    if explanation:
        p2 = cell.add_paragraph()
        p2.paragraph_format.space_before = Pt(2)
        p2.paragraph_format.space_after = Pt(2)
        run_exp = p2.add_run(explanation)
        run_exp.font.name = "Calibri"
        run_exp.font.size = Pt(9)
        run_exp.font.color.rgb = RGBColor(71, 85, 105)
    
    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(0)
    p_spacer.paragraph_format.space_after = Pt(4)

def format_styled_table(table, col_widths, headers, data, alignments=None):
    """Estiliza una tabla completa con cabecera verde oscuro y filas alternadas."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table)
    
    # Cabecera
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], "065F46")
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=120, right=120)
        p = hdr_cells[i].paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        if alignments and i < len(alignments):
            p.alignment = alignments[i]
        run = p.add_run(title)
        run.bold = True
        run.font.name = "Calibri"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(255, 255, 255)
    
    # Filas de datos
    for row_idx, row_data in enumerate(data):
        row = table.add_row()
        row_cells = row.cells
        bg_color = "FFFFFF" if row_idx % 2 == 0 else "F8FAFC"
        for i, val in enumerate(row_data):
            row_cells[i].width = col_widths[i]
            set_cell_background(row_cells[i], bg_color)
            set_cell_margins(row_cells[i], top=90, bottom=90, left=120, right=120)
            p = row_cells[i].paragraphs[0]
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.line_spacing = 1.1
            if alignments and i < len(alignments):
                p.alignment = alignments[i]
            run = p.add_run(str(val))
            run.font.name = "Calibri"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(30, 41, 59)

def build_professor_documentation():
    doc = Document()
    
    # Configurar márgenes de página: 1 pulgada (2.54 cm)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
    
    # Configurar estilo Normal
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Calibri'
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = RGBColor(30, 41, 59)
    style_normal.paragraph_format.line_spacing = 1.15
    style_normal.paragraph_format.space_after = Pt(5)
    
    # Encabezado Institucional
    p_inst = doc.add_paragraph()
    p_inst.paragraph_format.space_before = Pt(0)
    p_inst.paragraph_format.space_after = Pt(2)
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_inst = p_inst.add_run("UNIVERSIDAD LIBRE — FACULTAD DE INGENIERÍA\nPROGRAMA DE INGENIERÍA DE SISTEMAS\nCURSO: INGENIERÍA APLICADA")
    r_inst.font.name = "Calibri"
    r_inst.font.size = Pt(10)
    r_inst.bold = True
    r_inst.font.color.rgb = RGBColor(71, 85, 105)
    
    # Título Principal
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(4)
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("DOCUMENTACIÓN TÉCNICA Y GUÍA METODOLÓGICA:\nSIMULADOR DE ARQUITECTURAS DE SOFTWARE")
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(16)
    r_title.bold = True
    r_title.font.color.rgb = RGBColor(6, 95, 70)
    
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("Actividad 9: Modelado Matemático, Evaluación Multicriterio (MCDA-SAW), Frontera de Pareto 3D y Validación Isomorfa sobre el Proyecto EnRuta (Bogotá D.C.)")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(11)
    r_sub.font.italic = True
    r_sub.font.color.rgb = RGBColor(100, 116, 139)
    
    # Recuadro de Metadatos y Enlace al Simulador
    meta_table = doc.add_table(rows=1, cols=1)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    meta_table.columns[0].width = Inches(6.5)
    meta_cell = meta_table.rows[0].cells[0]
    set_cell_background(meta_cell, "ECFDF5")
    set_cell_margins(meta_cell, top=140, bottom=140, left=180, right=180)
    set_callout_borders(meta_cell, border_hex="10B981")
    
    p_meta = meta_cell.paragraphs[0]
    p_meta.paragraph_format.space_before = Pt(2)
    p_meta.paragraph_format.space_after = Pt(2)
    p_meta.paragraph_format.line_spacing = 1.2
    
    r_meta_lbl = p_meta.add_run("🌐 ENLACE AL SIMULADOR EN LÍNEA (GITHUB PAGES):\n")
    r_meta_lbl.bold = True
    r_meta_lbl.font.size = Pt(10.5)
    r_meta_lbl.font.color.rgb = RGBColor(6, 95, 70)
    
    r_link = p_meta.add_run("https://teach1030.github.io/EnRuta/\n")
    r_link.bold = True
    r_link.font.size = Pt(11)
    r_link.font.color.rgb = RGBColor(16, 185, 129)
    
    r_authors = p_meta.add_run(
        "• Ingenieros Autores: Juan Esteban Guerrero Vera, Santiago Casas Barreto, Jose Sebastian Villalba\n"
        "• Sistema Objeto de Estudio: EnRuta — Optimización Logística de Última Milla (Bogotá D.C.)\n"
        "• Repositorio Oficial GitHub: https://github.com/teach1030/EnRuta\n"
        "• Versión del Motor Matemático: v1.0.0 (FastAPI 0.115 + TypeScript Client Engine Espejo)"
    )
    r_authors.font.size = Pt(9.5)
    r_authors.font.color.rgb = RGBColor(30, 41, 59)
    
    doc.add_paragraph() # Separador
    
    # -------------------------------------------------------------
    # SECCIÓN 1: DESCRIPCIÓN DEL MODELO Y CONTEXTO DEL PROYECTO
    # -------------------------------------------------------------
    h1 = doc.add_heading("1. Descripción del Modelo y Contexto del Proyecto EnRuta", level=1)
    h1.runs[0].font.name = "Calibri"
    h1.runs[0].font.size = Pt(13)
    h1.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    doc.add_paragraph(
        "El presente simulador de software fue diseñado para modelar, evaluar y comparar de manera analítica y "
        "reproducible cuatro arquitecturas de software contemporáneas aplicadas a un sistema real de producción: "
        "EnRuta. EnRuta es una plataforma desarrollada a lo largo del curso para solucionar los cuellos de botella "
        "críticos en la logística de distribución de paquetes y mercancías en Bogotá D.C., Colombia."
    )
    
    doc.add_paragraph(
        "La operación real de EnRuta se caracteriza por tres cargas computacionales heterogéneas concurrentes:"
    )
    
    doc.add_paragraph(
        "1. Carga Intensiva de Visión Artificial (E/S y Red): Durante la ventana matutina de cargue en bodegas "
        "(6:00 a.m. a 8:00 a.m.), los conductores escanean guías de transporte heterogéneas (Servientrega, "
        "Coordinadora, Interrapidísimo, iMile, etc.) mediante OCR multimodal (Google Gemini Vision / ML Kit).",
        style='List Bullet'
    )
    doc.add_paragraph(
        "2. Carga Transaccional Urbana (CRUD y Filtros): Normalización de nomenclatura bogotana (Calles, Carreras, "
        "Diagonales, Transversales, Torres y Apartamentos) y actualización en ruta de entregas multi-cliente "
        "asociadas a una misma portería residencial (StopClient en relación 1:N con Stop).",
        style='List Bullet'
    )
    doc.add_paragraph(
        "3. Carga Algorítmica Combinatoria (CPU pura): Optimización de la secuencia de reparto mediante el problema "
        "del Viajante de Comercio Abierto (Open TSP) resuelto en C++ con Google OR-Tools sobre matrices de distancia "
        "geodésica Haversine de complejidad O(N_p^2).",
        style='List Bullet'
    )
    
    doc.add_paragraph(
        "Para garantizar un análisis riguroso y no sesgado, el simulador compara cuatro alternativas de arquitectura "
        "que resuelven exactamente los mismos requerimientos funcionales pero difieren en su estrategia de "
        "aislamiento de procesos, ubicación del cómputo y modelo de aprovisionamiento:"
    )
    
    # Tabla de las 4 arquitecturas
    arch_widths = [Inches(1.8), Inches(1.2), Inches(3.5)]
    arch_headers = ["Arquitectura Candidata", "Topología", "Mapeo Técnico en EnRuta"]
    arch_data = [
        [
            "1. MONO_MVP\n(Monolito Ligero VPS)",
            "Host Único VM\n(0 contenedores)",
            "FastAPI ejecutando in-process autenticación, paradas, OCR síncrono y OR-Tools sobre PostgreSQL 16. Arquitectura actual en desarrollo."
        ],
        [
            "2. MONO_ASYNC_CONTAINER\n(Monolito + Workers)",
            "Docker Compose\n(3 contenedores)",
            "Contenedor de API HTTP desacoplado de workers en segundo plano para OCR y OR-Tools mediante cola en memoria Redis."
        ],
        [
            "3. MICRO_DOCKER\n(Microservicios Docker)",
            "Clúster Contenerizado\n(5 contenedores)",
            "Nginx API Gateway enrutando hacia ms-auth-drivers, ms-stops-bogota, ms-ocr-vision y ms-tsp-ortools dedicados con aislamiento de red."
        ],
        [
            "4. HYBRID_EDGE_SERVERLESS\n(Edge ML Kit + FaaS)",
            "Híbrida Borde/Cloud\n(Scale-to-Zero)",
            "85% del OCR resuelto localmente en el móvil con Google ML Kit on-device; backend en Cloud Run efímero y PostgreSQL serverless."
        ]
    ]
    t_arch = doc.add_table(rows=1, cols=3)
    format_styled_table(t_arch, arch_widths, arch_headers, arch_data, [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT])
    
    add_callout(
        doc,
        "Todas las fórmulas y constantes del simulador fueron calibradas con base en cuatro publicaciones científicas "
        "arbitradas: Sunardi & Suharjito (2019, Procedia CS), Tapia et al. (2020, Applied Sciences), Blinowski, Ojdowska & "
        "Przybyłek (2022, IEEE Access) y Al-Debagy & Martinek (2018, IEEE CINTI).",
        title="FUNDAMENTACIÓN CIENTÍFICA"
    )
    
    # -------------------------------------------------------------
    # SECCIÓN 2: DEFINICIÓN DE LAS VARIABLES
    # -------------------------------------------------------------
    h2 = doc.add_heading("2. Definición y Justificación de las Variables del Simulador", level=1)
    h2.runs[0].font.name = "Calibri"
    h2.runs[0].font.size = Pt(13)
    h2.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    doc.add_paragraph(
        "El simulador expone dos grupos de variables plenamente configurables: las variables de carga operativa "
        "(SimulationInput) que describen la demanda física sobre el sistema logístico, y las variables de perfil "
        "del proyecto (ProjectConfig) que fijan las restricciones no funcionales y los pesos del modelo de decisión."
    )
    
    h2_1 = doc.add_heading("2.1 Variables Dinámicas de Carga e Ingreso (SimulationInput)", level=2)
    h2_1.runs[0].font.name = "Calibri"
    h2_1.runs[0].font.size = Pt(11.5)
    h2_1.runs[0].font.color.rgb = RGBColor(15, 23, 42)
    
    var_widths = [Inches(0.8), Inches(1.4), Inches(0.9), Inches(0.8), Inches(2.6)]
    var_headers = ["Símbolo", "Variable en Sistema", "Rango", "Base", "Impacto y Justificación en EnRuta"]
    var_data = [
        [
            "U",
            "Conductores Concurrentes\n(concurrent_drivers)",
            "[1, 5000]",
            "35",
            "Número de mensajeros urbanos activos en la ventana pico matutina W=1800 s. Determina la tasa global de solicitudes entrantes."
        ],
        [
            "G",
            "Guías OCR por Conductor\n(ocr_guides_per_driver)",
            "[0, 150]",
            "30",
            "Etiquetas impresas que cada conductor fotografía en bodega para su alistamiento. Controla la presión de ancho de banda y costo de la API OCR."
        ],
        [
            "N_p",
            "Paradas por Ruta\n(stops_per_route)",
            "[2, 150]",
            "30",
            "Destinos geográficos a ordenar. Afecta exponencialmente el cálculo de la matriz Haversine y la resolución del TSP en Google OR-Tools."
        ],
        [
            "I",
            "Instancias de Cómputo\n(compute_instances)",
            "[1, 20]",
            "1",
            "Réplicas de procesamiento asignadas. Permite observar el beneficio del escalado horizontal y la saturación por coordinación inter-nodo para I > 6."
        ],
        [
            "F_crud",
            "Frecuencia Operaciones CRUD\n(crud_ops_per_min)",
            "[0.5, 60.0]",
            "6.0",
            "Consultas y confirmaciones de entrega (swipes por portería) que cada conductor realiza por minuto durante su recorrido."
        ]
    ]
    t_vars = doc.add_table(rows=1, cols=5)
    format_styled_table(t_vars, var_widths, var_headers, var_data, [WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT])
    
    doc.add_paragraph()
    h2_2 = doc.add_heading("2.2 Restricciones del Proyecto y Pesos de Decisión (ProjectConfig)", level=2)
    h2_2.runs[0].font.name = "Calibri"
    h2_2.runs[0].font.size = Pt(11.5)
    h2_2.runs[0].font.color.rgb = RGBColor(15, 23, 42)
    
    cfg_widths = [Inches(1.0), Inches(1.8), Inches(1.0), Inches(2.7)]
    cfg_headers = ["Restricción", "Campo en el Simulador", "Valor Base", "Rol en el Motor de Decisión"]
    cfg_data = [
        [
            "B_max",
            "Presupuesto Tope (USD/mes)\n(max_budget_usd)",
            "$25.00 USD",
            "Restricción dura financiera. Activa penalización severa en el puntaje si el costo mensual excede el límite del MVP."
        ],
        [
            "L_max",
            "Latencia Máxima SLA (ms)\n(max_latency_ms)",
            "1500.0 ms",
            "Restricción dura de rendimiento. Umbral máximo tolerable en calle bajo conectividad móvil 4G."
        ],
        [
            "A_min",
            "Disponibilidad Mínima (%)\n(min_availability_pct)",
            "99.00 %",
            "Restricción dura de continuidad de servicio en horas de entrega diurna."
        ],
        [
            "E_team",
            "Tamaño del Equipo Técnico\n(team_size)",
            "3 ingenieros",
            "Evalúa la viabilidad operativa frente a la complejidad DevOps de microservicios o Kubernetes."
        ],
        [
            "e_enc",
            "Cifrado Obligatorio\n(require_encryption)",
            "True",
            "Otorga bonificación de +6 puntos en seguridad al exigir TLS extremo a extremo (Ley 1581 de Habeas Data)."
        ],
        [
            "w",
            "Vector de Pesos MCDA\n(weights)",
            "(25%, 15%, 20%,\n15%, 15%, 10%)",
            "Ponderaciones para Latencia, Throughput, Escalabilidad, Disponibilidad, Costo y Seguridad/Equipo respectivamente."
        ]
    ]
    t_cfg = doc.add_table(rows=1, cols=4)
    format_styled_table(t_cfg, cfg_widths, cfg_headers, cfg_data, [WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT])
    
    add_callout(
        doc,
        "Validación Defensiva (Requisito 10): El simulador sanitiza automáticamente números con coma decimal (ej. '0,25' o '99,5') "
        "y rechaza de forma estricta valores negativos, rutas con menos de 2 paradas o disponibilidades mayores a 100%, "
        "emitiendo respuestas estructuradas HTTP 422 con diagnósticos claros en español.",
        title="CONTROL DEFENSIVO DE ERRORES",
        border_hex="0284C7",
        bg_hex="F0F9FF"
    )
    
    # -------------------------------------------------------------
    # SECCIÓN 3: LAS FÓRMULAS Y EL MODELO MATEMÁTICO
    # -------------------------------------------------------------
    h3 = doc.add_heading("3. Fórmulas y Modelo Matemático Completo", level=1)
    h3.runs[0].font.name = "Calibri"
    h3.runs[0].font.size = Pt(13)
    h3.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    doc.add_paragraph(
        "El motor analítico del simulador es completamente determinista y auditable. Se estructuran nueve bloques de "
        "ecuaciones cerradas que calculan el comportamiento del sistema a partir de las tasas de llegada, tiempos "
        "de servicio, degradación por encolamiento y costos unitarios."
    )
    
    # Bloque 1
    doc.add_heading("3.1 Bloque 1: Tasas de Solicitud y Fracción Cloud de OCR (req/s)", level=2)
    doc.add_paragraph(
        "Definiendo la ventana crítica matutina W = 1800 segundos (30 minutos) y una tasa media de recálculos de ruta "
        "R_recalc = 1.5 por conductor:"
    )
    add_formula_box(
        doc,
        "λ_crud = (U · F_crud) / 60\nλ_ocr,raw = (U · G) / W\nλ_ocr,cloud = λ_ocr,raw · θ_cloud_ocr\nλ_tsp = (U · R_recalc) / W\n\n"
        "Λ_client = λ_crud + λ_ocr,raw + λ_tsp\nΛ_backend = λ_crud + λ_ocr,cloud + λ_tsp",
        "Donde θ_cloud_ocr = 0.15 para la arquitectura Híbrida Edge (85% procesado gratis en el teléfono con Google ML Kit) "
        "y θ_cloud_ocr = 1.0 para las tres arquitecturas basadas en servidor."
    )
    
    # Bloque 2
    doc.add_heading("3.2 Bloque 2: Complejidad Algorítmica de Ruteo TSP (Google OR-Tools)", level=2)
    doc.add_paragraph(
        "El cálculo de distancias geodésicas Haversine y la resolución de Open TSP mediante Guided Local Search "
        "escala de forma superlineal con respecto a la cantidad de paradas N_p:"
    )
    add_formula_box(
        doc,
        "φ_tsp(N_p) = (N_p / 30)^1.85",
        "Toma como punto normalizado de referencia una ruta urbana típica de 30 paradas (φ_tsp = 1.00). "
        "Para rutas extensas de 115 paradas, la demanda algorítmica se multiplica por 12.02 veces."
    )
    
    # Bloque 3
    doc.add_heading("3.3 Bloque 3: Demanda, Sobre-Escalado Horizontal y Utilización", level=2)
    doc.add_paragraph(
        "La demanda agregada D y la capacidad efectiva C(I) incorporan el fenómeno de sobre-escalado "
        "identificado experimentalmente por Blinowski et al. (2022):"
    )
    add_formula_box(
        doc,
        "D = (λ_crud · c_crud) + (λ_ocr,cloud · c_ocr) + (λ_tsp · c_tsp · φ_tsp)\n\n"
        "f_over(I) = max(0.55,  1.0 - β_coord · [max(0, I - 6)]^2)\n\n"
        "C(I) = μ_0 · (I^η) · f_over(I)\n\n"
        "ρ = D / max(C(I), 10^-6)",
        "El término I^η refleja la ley de rendimientos decrecientes del escalado (η = 0.62 en monolito vs 0.92 en microservicios). "
        "El factor f_over penaliza drásticamente cuando se asignan más de 6 réplicas debido al overhead de sincronización y red."
    )
    
    # Bloque 4
    doc.add_heading("3.4 Bloque 4: Latencia Extremo a Extremo con Modelo de Encolamiento M/G/1", level=2)
    doc.add_paragraph(
        "El tiempo de respuesta percibido por el conductor integra la latencia base, sobrecarga IPC de red, "
        "tiempo medio de servicio ponderado, multiplicador asintótico de cola y penalización de arranque en frío:"
    )
    add_formula_box(
        doc,
        "L_ipc(I) = l_ipc,base + l_ipc_inst · max(0, I - 1)\n\n"
        "τ_tsp = τ_tsp,base + α_tsp · φ_tsp\n"
        "τ_prom = [(λ_crud · τ_crud) + (λ_ocr,cloud · τ_ocr) + (λ_tsp · τ_tsp)] / Λ_backend\n\n"
        "ρ_eff = min(ρ, 0.985)\n"
        "M_q(ρ_eff) = 1.0 + [ (ρ_eff^2) / (1.0 - ρ_eff) ]\n"
        "L_sat(ρ) = 2800 · max(0, ρ - 1.0)\n\n"
        "L = l_base + L_ipc(I) + [ τ_prom · M_q(ρ_eff) ] + L_cold + L_sat(ρ)",
        "Captura el retraso de saltos de red medido por Al-Debagy (2018), el colapso no lineal de cola cuando la utilización "
        "supera el 80% y los arranques en frío serverless para rutas complejas (L_cold)."
    )
    
    # Bloque 5
    doc.add_heading("3.5 Bloque 5: Throughput Efectivo y Tasa de Error", level=2)
    doc.add_paragraph(
        "Cuando el sistema entra en saturación (ρ > 92%), se modela el descarte de solicitudes por timeout o rechazo HTTP 503:"
    )
    add_formula_box(
        doc,
        "p_drop = 0.0  si  ρ <= 0.92,   sino   min(0.85, 1.0 - [0.92 / ρ])\n\n"
        "Tasa_Error (%) = p_drop · 100\n"
        "Throughput (req/s) = Λ_client · (1.0 - p_drop)",
        "Permite evaluar la degradación controlada frente a la caída abrupta del servicio bajo picos de tráfico."
    )
    
    # Bloque 6
    doc.add_heading("3.6 Bloque 6: Disponibilidad SLA con Degradación por SPOF (%)", level=2)
    doc.add_paragraph(
        "La redundancia en paralelo de nodos efectivos m_eff está acotada por el punto único de fallo (SPOF) estructural:"
    )
    add_formula_box(
        doc,
        "m_eff = min(I, m_max_avail)\n"
        "A_paralelo = 1.0 - (1.0 - a_0)^m_eff\n"
        "ΔA_stress = δ_spof · max(0, ρ - 0.80)\n\n"
        "Disponibilidad (%) = 100 · max(0.90, min(0.9999, A_paralelo - ΔA_stress))",
        "Explica por qué un monolito con base de datos acoplada (m_max=1, δ_spof=0.018) no puede alcanzar SLAs de 4 nueves (99.99%), "
        "mientras que microservicios distribuidos (m_max=6, δ_spof=0.003) sí lo consiguen."
    )
    
    # Bloque 7
    doc.add_heading("3.7 Bloque 7: Facturación Mensual Estimada Cloud (USD/mes)", level=2)
    doc.add_paragraph(
        "Proyectando 26 días operativos al mes en Bogotá (lunes a sábado):"
    )
    add_formula_box(
        doc,
        "G_mes = 26 · U · G,      Q_mes = 26 · Λ_client · W\n\n"
        "Régimen Servidor Fijo:\n"
        "Costo_USD = (c_infra · I) + c_gateway_fijo + (G_mes · c_api_ocr)\n\n"
        "Régimen Serverless (FaaS):\n"
        "Costo_USD = [8 · max(0, I - 1)] + 0.00008 · max(0, Q_mes - 150000) · (1 + 0.35 · φ_tsp) + (G_mes · c_api_ocr)",
        "Demuestra por qué el MVP es altamente rentable en Serverless ($4.59 USD) al aprovechar la capa gratuita, "
        "mientras que microservicios ($48.83 USD) exige un costo base alto de infraestructura."
    )
    
    # Tabla de parámetros calibrados
    doc.add_paragraph()
    doc.add_heading("3.8 Matriz Completa de Parámetros Calibrados", level=2)
    doc.add_paragraph(
        "La siguiente tabla reúne los coeficientes numéricos calibrados en simulator/backend/app/engine/architectures.py:"
    )
    
    par_widths = [Inches(1.6), Inches(1.1), Inches(1.1), Inches(1.1), Inches(1.6)]
    par_headers = ["Parámetro Técnico", "Monolito MVP", "Monolito Workers", "Microservicios", "Edge Serverless"]
    par_data = [
        ["Capacidad Base (μ_0)", "85.0 unid/s", "140.0 unid/s", "210.0 unid/s", "165.0 unid/s"],
        ["Eficiencia Escalado (η)", "0.62", "0.78", "0.92", "0.88"],
        ["Coord. Blinowski (β)", "0.012", "0.009", "0.008", "0.004"],
        ["Fracción Cloud OCR (θ)", "1.00 (100%)", "1.00 (100%)", "1.00 (100%)", "0.15 (15%)"],
        ["Latencia Base (l_base)", "38.0 ms", "44.0 ms", "52.0 ms", "48.0 ms"],
        ["Sobrecarga Red IPC", "0.0 ms", "9.0 + 1.2·(I-1)", "24.0 + 2.1·(I-1)", "14.0 + 0.5·(I-1)"],
        ["Costo Base Infraestructura", "$12.0 / inst", "$18.0 / inst", "$24.0 / inst", "$0.0 (Pago por uso)"],
        ["Costo Fijo Gateway/Broker", "$0.0", "$6.0 / mes", "$18.0 / mes", "$0.0"],
        ["Contenedores / Réplica", "0 (VM)", "3 (Docker)", "5 (Docker)", "0 (Serverless)"],
        ["Overhead CPU Docker", "4.0 %", "7.5 %", "12.5 %", "5.5 %"],
        ["Aislamiento Modular (ψ)", "0.15", "0.62", "0.95", "0.80"],
        ["Complejidad DevOps", "18 / 100", "45 / 100", "82 / 100", "25 / 100"]
    ]
    t_par = doc.add_table(rows=1, cols=5)
    format_styled_table(t_par, par_widths, par_headers, par_data, [WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER])
    
    # -------------------------------------------------------------
    # SECCIÓN 4: CRITERIOS DE DECISIÓN Y RESTRICCIONES
    # -------------------------------------------------------------
    doc.add_paragraph()
    h4 = doc.add_heading("4. Criterios de Decisión, Restricciones y Análisis de Pareto 3D", level=1)
    h4.runs[0].font.name = "Calibri"
    h4.runs[0].font.size = Pt(13)
    h4.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    doc.add_paragraph(
        "El simulador no selecciona arquitecturas de forma arbitraria; combina el método multicriterio formal "
        "SAW (Simple Additive Weighting), la frontera de optimalidad de Pareto en tres dimensiones y un sistema "
        "de penalizaciones defensivas."
    )
    
    doc.add_heading("4.1 Evaluación Multicriterio MCDA-SAW y Normalización Min-Max", level=2)
    doc.add_paragraph(
        "Para cada criterio c, se normalizan los valores observados en el rango [0, 1] entre las cuatro arquitecturas:"
    )
    add_formula_box(
        doc,
        "Criterios de Costo (Latencia, Presupuesto):\n"
        "u_i,c = (v_max,c - v_i,c) / (v_max,c - v_min,c)\n\n"
        "Criterios de Beneficio (Throughput, Escalabilidad, Disponibilidad, Seguridad):\n"
        "u_i,c = (v_i,c - v_min,c) / (v_max,c - v_min,c)\n\n"
        "Puntaje Bruto SAW:\n"
        "Puntaje_Bruto = 100 · ∑ [ w_norm,c · u_i,c ]",
        "Donde los pesos w_norm,c se normalizan para asegurar estrictamente que su suma sea igual al 100%."
    )
    
    doc.add_heading("4.2 Penalizaciones por Restricciones Duras y Amortiguación Proporcional", level=2)
    doc.add_paragraph(
        "Si una arquitectura incumple una restricción obligatoria fijada por el arquitecto, se calculan penalizaciones:"
    )
    doc.add_paragraph(
        "• Penalización Presupuesto: 18 + 20 · (Costo - B_max) / B_max  (si Costo > B_max)\n"
        "• Penalización Latencia: 20 + 20 · (Latencia - L_max) / L_max  (si Latencia > L_max)\n"
        "• Penalización Disponibilidad: 22 + 25 · (A_min - Disponibilidad)  (si Disp < A_min)\n"
        "• Penalización Capacidad: 20 puntos si la utilización ρ > 105%"
    )
    
    add_callout(
        doc,
        "Mecanismo de Amortiguación Proporcional (Solución al error de puntajes 0.0): Anteriormente, cuando una arquitectura "
        "acumulaba varias penalizaciones que superaban su puntaje bruto, el valor era truncado a cero (0.0). Se diseñó una "
        "amortiguación proporcional defensiva basada en la tasa de saturación que garantiza un puntaje mínimo continuo y "
        "discriminativo (mayor a 0.5 puntos), preservando la trazabilidad del ranking para el evaluador.",
        title="INNOVACIÓN EN EL MOTOR DE DECISIÓN",
        border_hex="059669",
        bg_hex="ECFDF5"
    )
    
    doc.add_heading("4.3 Frontera de Optimalidad de Pareto 3D", level=2)
    doc.add_paragraph(
        "De manera previa a los pesos subjetivos, se evalúa si una arquitectura domina en sentido de Pareto a otra en "
        "el espacio de tres objetivos fundamentales: Minimizar Costo, Minimizar Latencia y Maximizar Disponibilidad. "
        "Una alternativa es Pareto-eficiente si no existe ninguna otra opción que sea estrictamente mejor o igual en "
        "los tres aspectos al mismo tiempo."
    )
    
    # -------------------------------------------------------------
    # SECCIÓN 5: INSTRUCCIONES DE USO DEL SIMULADOR
    # -------------------------------------------------------------
    doc.add_paragraph()
    h5 = doc.add_heading("5. Instrucciones de Uso del Simulador (Paso a Paso)", level=1)
    h5.runs[0].font.name = "Calibri"
    h5.runs[0].font.size = Pt(13)
    h5.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    doc.add_paragraph(
        "El simulador cuenta con dos modalidades de despliegue: en la nube mediante GitHub Pages para acceso móvil "
        "inmediato durante sustentaciones, y de forma local en contenedores Docker para auditoría de código."
    )
    
    doc.add_heading("5.1 Acceso Web Instantáneo y Código QR para el Aula de Clase", level=2)
    doc.add_paragraph(
        "1. Ingrese desde cualquier navegador web a la dirección pública:\n   https://teach1030.github.io/EnRuta/\n"
        "2. Para compartir el escenario actual en el salón, presione el botón superior «📱 Mostrar QR para el Salón».\n"
        "3. El docente y los estudiantes pueden escanear el código QR directamente con la cámara de sus teléfonos inteligentes. "
        "El enlace codifica en la URL todos los parámetros y sliders actuales, abriendo la simulación exacta en sus celulares.",
        style='Normal'
    )
    
    doc.add_heading("5.2 Ejecución Local en Contenedores Docker", level=2)
    doc.add_paragraph(
        "Para ejecutar la solución contenerizada completa con backend FastAPI y frontend Nginx en su máquina local:"
    )
    add_formula_box(
        doc,
        "# 1. Clonar el repositorio y ubicarse en la raíz:\n"
        "git clone https://github.com/teach1030/EnRuta.git\n"
        "cd EnRuta\n\n"
        "# 2. Construir y levantar los contenedores en segundo plano:\n"
        "docker compose -f simulator/docker-compose.yml up --build -d\n\n"
        "# 3. Ejecutar la suite completa de 19 pruebas automatizadas (QA):\n"
        "docker compose -f simulator/docker-compose.yml --profile qa run --rm sim-qa-tests",
        "Puntos de acceso locales:\n"
        "• Aplicación Web del Simulador: http://localhost:8080/\n"
        "• Documentación Interactiva Swagger UI de la API: http://localhost:8000/docs\n"
        "• Endpoint de Estado del Servicio: http://localhost:8000/api/v1/health"
    )
    
    doc.add_heading("5.3 Guía de Navegación por la Interfaz del Simulador", level=2)
    doc.add_paragraph(
        "• Panel 1 (Restricciones del Proyecto): Permite editar el presupuesto máximo, la latencia SLA admisible, "
        "la disponibilidad mínima requerida y ajustar los pesos relativos de los 6 criterios de evaluación.\n"
        "• Panel 2 (Escenarios y Carga): Permite alternar entre los cinco escenarios preconfigurados de Bogotá "
        "(Línea Base MVP, Pico Matutino OCR, Rutas Densas TSP, Escala Nacional y Demostración de Sobre-escalado), "
        "o modificar individualmente los conductores concurrentes, guías por conductor, paradas por ruta e instancias.\n"
        "• Panel 3 (Comparativa Técnica y Gráficas): Presenta la tabla comparativa completa con 12 métricas técnicas, "
        "la curva de escalabilidad de conductores, la frontera de Pareto y la curva de degradación por sobre-escalado.\n"
        "• Panel 4 (Asesor de Decisión Explicable): Muestra la arquitectura ganadora, el ranking ponderado de 0 a 100, "
        "el desglose paso a paso de fórmulas y las justificaciones técnicas de por qué ganaron o perdieron las demás opciones."
    )
    
    # -------------------------------------------------------------
    # SECCIÓN 6: SUPUESTOS Y LIMITACIONES DEL SIMULADOR
    # -------------------------------------------------------------
    doc.add_paragraph()
    h6 = doc.add_heading("6. Supuestos y Limitaciones del Simulador", level=1)
    h6.runs[0].font.name = "Calibri"
    h6.runs[0].font.size = Pt(13)
    h6.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    doc.add_paragraph(
        "En estricto cumplimiento con el rigor científico y el Requisito 12 de la guía de la asignatura, "
        "se declaran formalmente los supuestos y límites del modelo analítico:"
    )
    
    doc.add_heading("6.1 Supuestos Asumidos en el Modelo", level=2)
    doc.add_paragraph(
        "1. Estacionariedad en la Ventana Pico: Las tasas de llegada de conductores, guías y paradas se asumen constantes "
        "y homogéneas durante la ventana de análisis de 30 minutos (W = 1800 s).\n"
        "2. Calendario Logístico Colombiano: La proyección de costos mensuales se calcula sobre 26 días laborables al mes "
        "(lunes a sábado) representativos de la operación en Bogotá D.C.\n"
        "3. Efectividad del Modelo Edge OCR: Se asume que el 85% de las guías físicas fotografiadas tienen suficiente calidad "
        "para ser procesadas por Google ML Kit en el dispositivo móvil, requiriendo solo un 15% de fallback hacia la API cloud.\n"
        "4. Homogeneidad de Hardware: Cada instancia horizontal I posee idéntica capacidad nominal de cómputo y memoria."
    )
    
    doc.add_heading("6.2 Limitaciones Reconocidas", level=2)
    doc.add_paragraph(
        "1. Modelo Analítico vs. Simulación Estocástica: El simulador emplea soluciones analíticas cerradas en estado "
        "estacionario (colas M/G/1) en lugar de una simulación de eventos discretos a nivel de paquetes TCP. No modela "
        "micro-pérdidas de cobertura celular en túneles o sótanos de la ciudad.\n"
        "2. Valores Medios frente a Percentiles Extremos: Las fórmulas computan latencias medias ponderadas; en un entorno "
        "productivo real pueden existir distribuciones de cola larga con percentiles p95 y p99 más dispersos.\n"
        "3. Precios de Referencia Estáticos: Los costos de cómputo VPS y tarifas de API son promedios de mercado que pueden "
        "variar ante fluctuaciones en la tasa de cambio peso colombiano frente al dólar (TRM)."
    )
    
    add_callout(
        doc,
        "Declaración de Alcance (Requisito 12): Los resultados numéricos generados por el simulador son estimaciones "
        "matemáticas derivadas de modelos científicos y no constituyen mediciones físicas en tiempo real de servidores. "
        "Para validar estas conclusiones en una implementación productiva de EnRuta, se requeriría ejecutar pruebas de "
        "carga controladas con Apache JMeter sobre escenarios parametrizados (.jmx), instrumentar trazas distribuidas con "
        "New Relic / OpenTelemetry, recolectar métricas de contenedores con Prometheus + Grafana y calcular la mediana de "
        "al menos 30 corridas independientes.",
        title="DECLARACIÓN METODOLÓGICA OBLIGATORIA",
        border_hex="B91C1C",
        bg_hex="FEF2F2"
    )
    
    # -------------------------------------------------------------
    # SECCIÓN 7: REFERENCIAS BIBLIOGRÁFICAS
    # -------------------------------------------------------------
    doc.add_paragraph()
    h7 = doc.add_heading("7. Referencias Científicas y Bibliográficas", level=1)
    h7.runs[0].font.name = "Calibri"
    h7.runs[0].font.size = Pt(13)
    h7.runs[0].font.color.rgb = RGBColor(6, 95, 70)
    
    refs = [
        "Sunardi, A., & Suharjito. (2019). MVC Architecture: A Comparative Study Between Laravel Framework and Slim Framework in Freelancer Project Monitoring System Web Based. Procedia Computer Science, 157, 134–141. https://doi.org/10.1016/j.procs.2019.08.150",
        "Tapia, F., Mora, M. Á., Fuertes, W., Aules, H., Flores, E., & Toulkeridis, T. (2020). From Monolithic Systems to Microservices: A Comparative Study of Performance. Applied Sciences, 10(17), 5797. https://doi.org/10.3390/app10175797",
        "Blinowski, G., Ojdowska, A., & Przybyłek, A. (2022). Monolithic vs. Microservice Architecture: A Performance and Scalability Evaluation. IEEE Access, 10, 20357–20374. https://doi.org/10.1109/ACCESS.2022.3152803",
        "Al-Debagy, O., & Martinek, P. (2018). A Comparative Review of Microservices and Monolithic Architectures. In 2018 IEEE 18th International Symposium on Computational Intelligence and Informatics (CINTI) (pp. 149–154). IEEE. https://doi.org/10.1109/CINTI.2018.8928192",
        "Satyanarayanan, M. (2017). The Emergence of Edge Computing. Computer (IEEE), 50(1), 30–39. https://doi.org/10.1109/MC.2017.9",
        "Castro, P., Ishakian, V., Muthusamy, V., & Slominski, A. (2019). The Rise of Serverless Computing. Communications of the ACM, 62(12), 44–54. https://doi.org/10.1145/3368454"
    ]
    for r in refs:
        doc.add_paragraph(r, style='List Bullet')
    
    # Guardar documento
    output_path = os.path.join(os.path.dirname(__file__), "DOCUMENTACION_SIMULADOR_PROFESOR.docx")
    doc.save(output_path)
    print(f"Documento Word generado exitosamente en: {output_path}")

if __name__ == "__main__":
    build_professor_documentation()
