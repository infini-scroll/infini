import DefaultTheme from "vitepress/theme";
import InfiniPlayground from "./components/InfiniPlayground.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("InfiniPlayground", InfiniPlayground);
  },
};
