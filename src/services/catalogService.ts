import { supabase } from '../lib/supabase'

class CatalogService {
  async replaceUserCatalogWithGlobal(): Promise<void> {
    const { error } = await supabase.rpc('replace_user_catalog_with_global')
    if (error) throw error
  }
}

export default new CatalogService()
