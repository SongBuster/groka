import { useState } from 'react'
import { Loader2, Upload, Code, TestTube, Download, Eye, EyeOff, Store, FileUp, List, Trash2 } from 'lucide-react'
import pdfParser from '../services/pdfParser'
import supermarketService from '../services/supermarketService'
import parserConfigManager from '../services/parserConfigs'

interface ExtractedData {
  store?: string | null
  date?: string | null
  time?: string | null
  invoiceNumber?: string | null
  totalAmount?: number | null
  supermarketId?: string | null
  supermarketName?: string | null
  products: Array<{
    item_name: string
    quantity: number
    unit_price?: number | null
    price_per_kg?: number | null
    weight_kg?: number | null
    total: number
  }>
  fullText: string
  items: Array<{
    str: string
    x: number
    y: number
  }>
}

export default function ParserTrainerPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [detectedSupermarket, setDetectedSupermarket] = useState<any>(null)
  const [showRawText, setShowRawText] = useState(false)
  const [showItems, setShowItems] = useState(false)
  const [savedConfigs, setSavedConfigs] = useState(parserConfigManager.getAll())

  // Patrones personalizables
  const [patterns, setPatterns] = useState({
    storeName: { input: '', pattern: '', context: '' },
    nif: { input: '', pattern: '', context: '' },
    date: { input: '', pattern: '', context: '' },
    time: { input: '', pattern: '', context: '' },
    invoiceNumber: { input: '', pattern: '', context: '' },
    total: { input: '', pattern: '', context: '' },
    productLine: { input: '', pattern: '', context: '' }
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile || uploadedFile.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF válido')
      return
    }

    setFile(uploadedFile)
    await parseFile(uploadedFile)
  }

  const analyzeTextAndGeneratePattern = (searchText: string, fullText: string) => {
    if (!searchText.trim() || !fullText) {
      return { pattern: '', context: '' }
    }

    // Find the text in the full content
    const index = fullText.indexOf(searchText)
    if (index === -1) {
      return { pattern: '', context: '❌ No encontrado en el texto' }
    }

    // Get context around the found text (50 chars before and after)
    const contextStart = Math.max(0, index - 50)
    const contextEnd = Math.min(fullText.length, index + searchText.length + 50)
    const context = fullText.substring(contextStart, contextEnd)
      .replace(searchText, `**${searchText}**`) // Highlight the found text

    // Generate a regex pattern based on the text characteristics
    let pattern = ''
    
    // Check if it's a NIF (letter + 8 digits)
    if (/^[A-Z]-?\d{8}$/.test(searchText.replace(/[-\s]/g, ''))) {
      pattern = '[A-Z]-?\\d{8}'
    }
    // Check if it's a date (DD/MM/YYYY or DD-MM-YYYY)
    else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(searchText)) {
      pattern = '\\d{2}[/-]\\d{2}[/-]\\d{4}'
    }
    // Check if it's a time (HH:MM or HH:MM:SS)
    else if (/^\d{2}:\d{2}(:\d{2})?$/.test(searchText)) {
      pattern = '\\d{2}:\\d{2}(:\\d{2})?'
    }
    // Check if it's a number (integer or decimal)
    else if (/^\d+[.,]?\d*$/.test(searchText)) {
      pattern = '\\d+[.,]?\\d*'
    }
    // Check if it's an invoice/ticket number
    else if (/^\d+$/.test(searchText)) {
      pattern = '\\d+'
    }
    // Generic text pattern (escape special chars)
    else {
      pattern = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    return { pattern, context }
  }

  const handlePatternInput = (key: string, value: string) => {
    if (!extractedData) return

    const analysis = analyzeTextAndGeneratePattern(value, extractedData.fullText)
    setPatterns({
      ...patterns,
      [key]: {
        input: value,
        pattern: analysis.pattern,
        context: analysis.context
      }
    })
  }

  const parseFile = async (pdfFile: File) => {
    setLoading(true)
    try {
      const result = await pdfParser.parseTicketFromFile(pdfFile)
      
      // También obtener el texto completo e items individuales
      const pdfjs = await import('pdfjs-dist')
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1)
      const textContent = await page.getTextContent()
      
      const fullText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      const items = textContent.items.map((item: any) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5]
      }))

      const data = {
        ...result,
        fullText,
        items
      }
      setExtractedData(data)

      // Load supermarket info if detected
      if (result.supermarketId) {
        const supermarket = await supermarketService.getById(result.supermarketId)
        setDetectedSupermarket(supermarket)
      } else {
        setDetectedSupermarket(null)
      }
    } catch (error) {
      console.error('Error parsing PDF:', error)
      alert('Error al parsear el PDF')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      parserConfigManager.loadFromJSON(text)
      setSavedConfigs(parserConfigManager.getAll())
      alert(`✓ Configuración cargada: ${JSON.parse(text).supermarket}`)
    } catch (error) {
      alert('❌ Error al cargar la configuración. Verifica que sea un JSON válido.')
      console.error(error)
    }
  }

  const handleSaveCurrentConfig = () => {
    if (!extractedData) return

    const config = {
      supermarket: extractedData.supermarketName || extractedData.store || 'Unknown',
      supermarketId: extractedData.supermarketId || undefined,
      patterns: Object.entries(patterns).reduce((acc, [key, value]) => {
        if (value.pattern) {
          acc[key] = {
            example: value.input,
            pattern: value.pattern,
            context: value.context
          }
        }
        return acc
      }, {} as any),
      example: {
        store: extractedData.store,
        date: extractedData.date,
        time: extractedData.time,
        invoiceNumber: extractedData.invoiceNumber,
        total: extractedData.totalAmount,
        productsCount: extractedData.products.length
      }
    }

    parserConfigManager.add(config)
    setSavedConfigs(parserConfigManager.getAll())
    alert(`✓ Configuración guardada para: ${config.supermarket}`)
  }

  const handleDeleteConfig = (supermarket: string) => {
    if (confirm(`¿Eliminar configuración de ${supermarket}?`)) {
      parserConfigManager.remove(supermarket)
      setSavedConfigs(parserConfigManager.getAll())
    }
  }

  const exportConfig = () => {
    if (!extractedData) return

    const config = {
      supermarket: extractedData.supermarketName || extractedData.store || 'Unknown',
      supermarketId: extractedData.supermarketId || undefined,
      patterns: Object.entries(patterns).reduce((acc, [key, value]) => {
        if (value.pattern) {
          acc[key] = {
            example: value.input,
            pattern: value.pattern,
            context: value.context
          }
        }
        return acc
      }, {} as any),
      example: {
        store: extractedData.store,
        date: extractedData.date,
        time: extractedData.time,
        invoiceNumber: extractedData.invoiceNumber,
        total: extractedData.totalAmount,
        productsCount: extractedData.products.length
      }
    }

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parser-config-${extractedData.store?.toLowerCase().replace(/\s/g, '-') || 'unknown'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
          🔬 Parser Trainer
        </h1>
        <p className="text-secondary-600">
          Herramienta de desarrollo para entrenar parsers de tickets
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 mb-6">
        <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          1. Subir PDF de muestra
        </h2>
        
        <input
          type="file"
          id="pdf-trainer-upload"
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <button
          onClick={() => document.getElementById('pdf-trainer-upload')?.click()}
          disabled={loading}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Seleccionar PDF
            </>
          )}
        </button>

        {file && (
          <p className="mt-3 text-sm text-secondary-600">
            📄 Archivo cargado: <span className="font-medium">{file.name}</span>
          </p>
        )}
      </div>

      {/* Results Section */}
      {extractedData && (
        <>
          {/* Detected Supermarket Alert */}
          {detectedSupermarket ? (
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-300 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    backgroundColor: detectedSupermarket.color ? `${detectedSupermarket.color}20` : '#f3f4f6',
                    border: `2px solid ${detectedSupermarket.color || '#9ca3af'}`
                  }}
                >
                  <Store className="w-6 h-6" style={{ color: detectedSupermarket.color || '#374151' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-primary-700 font-medium">Supermercado detectado:</p>
                  <p className="text-2xl font-bold text-primary-900">{detectedSupermarket.name}</p>
                  {detectedSupermarket.nif && (
                    <p className="text-xs text-primary-600 mt-1">NIF: {detectedSupermarket.nif}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white bg-green-500">
                    ✓ Detectado
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-200 flex items-center justify-center text-2xl">
                  ⚠️
                </div>
                <div className="flex-1">
                  <p className="text-sm text-yellow-700 font-medium">No se pudo detectar el supermercado</p>
                  <p className="text-xs text-yellow-600 mt-1">El parser no encontró un NIF conocido en el ticket. Revisa el texto extraído para identificar patrones.</p>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Data */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 mb-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              2. Datos extraídos (Parser actual)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                <p className="text-sm text-primary-700 mb-1 font-medium">Supermercado</p>
                <p className="font-bold text-primary-900">{extractedData.supermarketName || '❌ No detectado'}</p>
              </div>

              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-600 mb-1">Tienda</p>
                <p className="font-semibold text-secondary-900">{extractedData.store || '❌ No detectado'}</p>
              </div>

              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-600 mb-1">Fecha</p>
                <p className="font-semibold text-secondary-900">{extractedData.date || '❌ No detectado'}</p>
              </div>

              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-600 mb-1">Hora</p>
                <p className="font-semibold text-secondary-900">{extractedData.time || '❌ No detectado'}</p>
              </div>

              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-600 mb-1">Nº Ticket</p>
                <p className="font-semibold text-secondary-900">{extractedData.invoiceNumber || '❌ No detectado'}</p>
              </div>

              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-600 mb-1">Total</p>
                <p className="font-semibold text-secondary-900">
                  {extractedData.totalAmount ? `${extractedData.totalAmount.toFixed(2)} €` : '❌ No detectado'}
                </p>
              </div>

              <div className="p-4 bg-secondary-50 rounded-lg">
                <p className="text-sm text-secondary-600 mb-1">Productos</p>
                <p className="font-semibold text-secondary-900">{extractedData.products.length} items</p>
              </div>
            </div>

            {/* Products List */}
            <div className="border-t border-secondary-200 pt-4">
              <h3 className="font-semibold text-secondary-900 mb-3">Productos detectados:</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {extractedData.products.map((product, idx) => (
                  <div key={idx} className="p-3 bg-secondary-50 rounded text-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{product.item_name}</span>
                      <span className="font-bold text-primary-600">{product.total.toFixed(2)} €</span>
                    </div>
                    <div className="text-xs text-secondary-600 mt-1">
                      {product.weight_kg ? (
                        <>Peso: {product.weight_kg} kg × {product.price_per_kg?.toFixed(2)} €/kg</>
                      ) : (
                        <>Cantidad: {product.quantity} × {product.unit_price?.toFixed(2)} €/ud</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Raw Data */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-secondary-900 flex items-center gap-2">
                <Code className="w-5 h-5" />
                3. Datos en bruto
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="px-3 py-1.5 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition-colors text-sm flex items-center gap-2"
                >
                  {showRawText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  Texto completo
                </button>
                <button
                  onClick={() => setShowItems(!showItems)}
                  className="px-3 py-1.5 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 transition-colors text-sm flex items-center gap-2"
                >
                  {showItems ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  Items individuales ({extractedData.items.length})
                </button>
              </div>
            </div>

            {showRawText && (
              <div className="mb-4">
                <h3 className="font-semibold text-secondary-900 mb-2 text-sm">Texto completo extraído:</h3>
                <pre className="p-4 bg-secondary-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto font-mono">
                  {extractedData.fullText}
                </pre>
              </div>
            )}

            {showItems && (
              <div>
                <h3 className="font-semibold text-secondary-900 mb-2 text-sm">Items individuales con posición:</h3>
                <div className="p-4 bg-secondary-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto font-mono">
                  {extractedData.items.map((item, idx) => (
                    <div key={idx} className="mb-1">
                      <span className="text-blue-400">[{idx}]</span>{' '}
                      <span className="text-yellow-400">x:{item.x.toFixed(1)}</span>{' '}
                      <span className="text-yellow-400">y:{item.y.toFixed(1)}</span>{' '}
                      <span className="text-white">"{item.str}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pattern Configuration */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 mb-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center gap-2">
              <Code className="w-5 h-5" />
              4. Entrenar patrones (Opcional)
            </h2>
            <p className="text-sm text-secondary-600 mb-4">
              Copia y pega el texto exacto que ves en el ticket para cada campo. El sistema lo buscará y generará el patrón automáticamente.
            </p>

            <div className="grid grid-cols-1 gap-6">
              {Object.entries(patterns).map(([key, value]) => (
                <div key={key} className="border border-secondary-200 rounded-lg p-4 bg-secondary-50">
                  <label className="block text-sm font-bold text-secondary-900 mb-2 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    value={value.input}
                    onChange={(e) => handlePatternInput(key, e.target.value)}
                    placeholder={`Ej: Escribe el ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} tal como aparece en el ticket`}
                    className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm mb-2"
                  />
                  
                  {value.input && (
                    <div className="mt-3 space-y-2">
                      {value.pattern && (
                        <div className="bg-green-50 border border-green-300 rounded p-3">
                          <p className="text-xs font-semibold text-green-800 mb-1">✓ Patrón generado:</p>
                          <code className="text-xs text-green-900 font-mono bg-green-100 px-2 py-1 rounded">{value.pattern}</code>
                        </div>
                      )}
                      {value.context && (
                        <div className="bg-blue-50 border border-blue-300 rounded p-3">
                          <p className="text-xs font-semibold text-blue-800 mb-1">📍 Encontrado en:</p>
                          <p className="text-xs text-blue-900 whitespace-pre-wrap font-mono">
                            ...{value.context}...
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save & Export */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200">
            <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              5. Guardar y exportar configuración
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSaveCurrentConfig}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <Store className="w-5 h-5" />
                Guardar configuración actual
              </button>
              <button
                onClick={exportConfig}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Descargar JSON
              </button>
            </div>
            <p className="text-sm text-secondary-600 mt-3">
              <strong>Guardar:</strong> Almacena la configuración en memoria para usarla inmediatamente.<br/>
              <strong>Descargar:</strong> Exporta un JSON para compartir o hacer backup.
            </p>
          </div>
        </>
      )}

      {/* Saved Configurations Manager */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-secondary-200 mb-6">
        <h2 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center gap-2">
          <List className="w-5 h-5" />
          Configuraciones guardadas ({savedConfigs.length})
        </h2>
        
        <div className="mb-4">
          <input
            type="file"
            id="config-upload"
            accept="application/json,.json"
            onChange={handleConfigUpload}
            className="hidden"
          />
          <button
            onClick={() => document.getElementById('config-upload')?.click()}
            className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <FileUp className="w-4 h-4" />
            Cargar configuración desde JSON
          </button>
        </div>

        {savedConfigs.length === 0 ? (
          <div className="text-center py-8 bg-secondary-50 rounded-lg border-2 border-dashed border-secondary-300">
            <p className="text-secondary-600 text-sm">
              No hay configuraciones guardadas todavía
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedConfigs.map((config, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                <div className="flex-1">
                  <p className="font-semibold text-secondary-900">{config.supermarket}</p>
                  <p className="text-xs text-secondary-600 mt-1">
                    {Object.keys(config.patterns).length} patrones configurados
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteConfig(config.supermarket)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 <strong>Tip:</strong> Las configuraciones guardadas se usan automáticamente cuando el parser detecta un supermercado conocido.
            Esto mejora la precisión de la extracción de datos.
          </p>
        </div>
      </div>
    </div>
  )
}
