import Image from "next/image";

const MainBanner = () => {
  return <section className="bg-white lg:grid lg:place-content-center">
    <div className="flex justify-evenly px-4 py-16 sm:px-6 sm:py-20 md:items-center">
    <div className="max-w-prose text-left">
      <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
        <span className="text-green-600">Divine Teachings of His Holiness</span>
        <strong className="text-amber-600"> Bhakti Dhira Damodara Swami </strong>
        
      </h1>

      <p className="mt-4 text-base text-pretty text-gray-700 sm:text-lg/relaxed">
      Anyone who has firm faith in the spiritual master can continue to make steady progress in the process of Krishna consciousness, 
      jumping over all the hurdles as they come and finally come out successful.
      </p>

      <div className="mt-4 flex gap-4 sm:mt-6">
        <a className="inline-block rounded border border-amber-600 bg-amber-600 px-5 py-3 font-medium text-white shadow-sm transition-colors hover:bg-amber-700" href="https://bddswami.com">
          Home
        </a>

        <a className="inline-block rounded border border-gray-200 px-5 py-3 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900" href="https://bddswami.com/biography-bhakti-dhira-damodara-swami/">
          Learn More
        </a>
      </div>
    </div>

    <div className="hidden md:flex">
        <Image 
            className="rounded-4xl- rounded-full"
            src="/bdds.jpg"
            alt="Main Banner"
            width={400}
            height={400}
        />
    </div>
  </div>
</section>   
}

export default MainBanner;