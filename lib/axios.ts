import axios from "axios";

const apiClient = axios.create({
  // baseURL: "https://raw.githubusercontent.com/amansaini1/mocki/master/",
  baseURL : 'https://bddsm-production.up.railway.app',
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
