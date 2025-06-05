import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SixLaneFlipperComponent } from "../blanket-blaster/six-lane-flipper/six-lane-flipper.component";

@Component({
  selector: "app-test",
  standalone: true,
  imports: [
    CommonModule,
    SixLaneFlipperComponent
  ],
  templateUrl: "./test.component.html",
  styleUrls: ["./test.component.scss"],
})
export class TestComponent {
  // Component is now empty as it just serves as a container for the six-lane-flipper
}
