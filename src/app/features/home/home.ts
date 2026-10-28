import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShinyText } from '../../shared/react-bits/shiny-text/shiny-text';
import { HomeHeader } from './components/home-header/home-header';
import { StartButton } from '../../shared/ui/start-button/start-button';

@Component({
  selector: 'app-home',
  imports: [RouterLink, StartButton, HomeHeader, ShinyText],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
