import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StartButton } from '../../../../shared/ui/start-button/start-button';
@Component({
  selector: 'app-home-header',
  imports: [RouterLink, StartButton],
  templateUrl: './home-header.html',
  styleUrl: './home-header.css',
})
export class HomeHeader {}
