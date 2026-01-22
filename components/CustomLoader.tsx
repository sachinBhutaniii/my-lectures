const CustomLoader = () => {
    return <div className="w-full max-w-sm">
  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
    <div className="h-full w-[80%] animate-pulse bg-amber-600"></div>
  </div>
  <p className="mt-4 text-center font-medium text-gray-700">Loading...</p>
</div>
}


export default CustomLoader;