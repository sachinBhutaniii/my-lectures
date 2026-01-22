"use client";
import { useRouter } from "next/navigation";
type ContentItemProps = {
  title : string,
  id : number,
  thumbnailUrl : string,

}

const ContentItem = ({title, thumbnailUrl, id} : ContentItemProps) => {

    const router = useRouter();
    
        const goToAbout = () => {
            router.push(`${id}`);
        };

    return  <article onClick={goToAbout} className="cursor-pointer overflow-hidden rounded-lg shadow-sm transition hover:shadow-lg h-full">
            <img alt="" src={thumbnailUrl} className="h-56 w-full object-cover p-2 rounded-lg"/>

            <div className="bg-white p-4 sm:p-6">
                {/* <time class="block text-xs text-gray-500"> 10th Oct 2022 </time> */}
                <a href="#">
                <h3 className="mt-0.5 text-lg text-amber-500 font-medium">
                    {title}
                </h3>
                </a>

                {/* <p className="mt-2 line-clamp-3 text-sm/relaxed text-gray-500">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit. Recusandae dolores, possimus
                pariatur animi temporibus nesciunt praesentium dolore sed nulla ipsum eveniet corporis
                quidem, mollitia itaque minus soluta, voluptates neque explicabo tempora nisi culpa eius
                atque dignissimos. Molestias explicabo corporis voluptatem?
                </p> */}
            </div>
        </article>
}

export default ContentItem;