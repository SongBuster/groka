/**
 * Parser configurations for different supermarkets
 * Add new configurations here as you train them
 */

export interface ParserConfig {
  supermarket: string
  supermarketId?: string
  patterns: {
    storeName?: {
      example: string
      pattern: string
      context: string
    }
    nif?: {
      example: string
      pattern: string
      context: string
    }
    date?: {
      example: string
      pattern: string
      context: string
    }
    time?: {
      example: string
      pattern: string
      context: string
    }
    invoiceNumber?: {
      example: string
      pattern: string
      context: string
    }
    total?: {
      example: string
      pattern: string
      context: string
    }
    productLine?: {
      example: string
      pattern: string
      context: string
    }
  }
  example: {
    store?: string | null
    date?: string | null
    time?: string | null
    invoiceNumber?: string | null
    total?: number | null
    productsCount: number
  }
}

// Store configurations in memory
// In production, you might want to load these from a database or API
const configurations: ParserConfig[] = []

export const parserConfigManager = {
  /**
   * Add a new parser configuration
   */
  add(config: ParserConfig): void {
    // Remove existing config for the same supermarket
    const index = configurations.findIndex(c => 
      c.supermarket.toLowerCase() === config.supermarket.toLowerCase()
    )
    if (index !== -1) {
      configurations.splice(index, 1)
    }
    configurations.push(config)
  },

  /**
   * Get configuration for a specific supermarket
   */
  get(supermarketName: string): ParserConfig | undefined {
    return configurations.find(c => 
      c.supermarket.toLowerCase() === supermarketName.toLowerCase()
    )
  },

  /**
   * Get all configurations
   */
  getAll(): ParserConfig[] {
    return [...configurations]
  },

  /**
   * Remove a configuration
   */
  remove(supermarketName: string): boolean {
    const index = configurations.findIndex(c => 
      c.supermarket.toLowerCase() === supermarketName.toLowerCase()
    )
    if (index !== -1) {
      configurations.splice(index, 1)
      return true
    }
    return false
  },

  /**
   * Clear all configurations
   */
  clear(): void {
    configurations.length = 0
  },

  /**
   * Load configuration from JSON
   */
  loadFromJSON(json: string): void {
    try {
      const config = JSON.parse(json) as ParserConfig
      this.add(config)
    } catch (error) {
      throw new Error('Invalid JSON format')
    }
  }
}

export default parserConfigManager
