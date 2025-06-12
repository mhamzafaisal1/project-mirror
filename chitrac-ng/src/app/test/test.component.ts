import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { BlanketBlasterModule } from "../blanket-blaster/blanket-blaster.module";

@Component({
    selector: "app-test",
    imports: [
        CommonModule,
        BlanketBlasterModule
    ],
    templateUrl: "./test.component.html",
    styleUrls: ["./test.component.scss"]
})
export class TestComponent {
  // Component is now empty as it just serves as a container for the demo-flipper
}
