export default function ProductsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-2">
          Productos
        </h1>
        <p className="text-secondary-600">
          Gestiona tus productos y categorías
        </p>
      </div>

      <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-secondary-300">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">
          Próximamente
        </h3>
        <p className="text-secondary-600 text-sm">
          Aquí podrás gestionar todos tus productos
        </p>
      </div>
    </div>
  )
}
