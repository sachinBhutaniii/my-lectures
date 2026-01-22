import { useFetch } from "@/hooks/useFetch";
import { getLanguageData } from "@/services/video.service";
import { LanguageData } from "@/types/videos";
import { useCallback, useState } from "react";

type DropwdownPropType = {
  handleSelectedLanguage: (language: string) => void;
};

const Dropwdown = ({ handleSelectedLanguage }: DropwdownPropType) => {
  const fetchVideo = useCallback(() => {
    return getLanguageData();
  }, []);

  const { data } = useFetch<LanguageData[]>(fetchVideo);

  const [showOption, setShowOptions] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [search, setSearch] = useState("");

  const toggleDropdown = () => {
    setShowOptions((prev) => !prev);
  };

  const changeSelectedLanguage = (lang: { name: string; code: string }) => {
    setSelectedLanguage(lang.name);
    setShowOptions(false);
    setSearch("");
    handleSelectedLanguage(lang.code);
  };

  const filteredLanguages = data?.filter((lang) =>
    lang.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative inline-flex">
      <span className="inline-flex divide-x divide-gray-300 overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
        <button
          type="button"
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {selectedLanguage || "Language"}
        </button>

        <button
          type="button"
          onClick={toggleDropdown}
          className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          aria-label="Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
      </span>

      {showOption && (
        <div
          role="menu"
          className="absolute end-0 top-12 z-10 w-56 rounded border border-gray-300 bg-white shadow-sm h-64 overflow-y-auto"
        >
          {/* Search */}
          <input
            type="text"
            placeholder="Search language..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border-b border-gray-200 focus:outline-none"
          />

          {/* Options */}
          {filteredLanguages && filteredLanguages.length > 0 ? (
            filteredLanguages.map((language, index) => (
              <span
                key={language.name + index}
                onClick={() => changeSelectedLanguage(language)}
                className="cursor-pointer block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-amber-400 hover:text-gray-900"
                role="menuitem"
              >
                {language.name}
              </span>
            ))
          ) : (
            <span className="block px-3 py-2 text-sm text-gray-400">
              No results found
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Dropwdown;
