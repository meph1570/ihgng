
import { handleMenu } from "../background/ui";

document.addEventListener("click", (e) => {
    let ihg = browser.extension.getBackgroundPage();
    handleMenu(ihg, e.target.id, e.shiftKey);
    window.close();
});