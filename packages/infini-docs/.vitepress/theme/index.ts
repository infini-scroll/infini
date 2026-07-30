import DefaultTheme from "vitepress/theme";
import HomeFeatures from "./components/HomeFeatures.vue";
import InfiniPlayground from "./components/InfiniPlayground.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("HomeFeatures", HomeFeatures);
    app.component("InfiniPlayground", InfiniPlayground);
  },
};
