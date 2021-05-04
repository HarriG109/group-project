import { Injectable } from "@angular/core";
import { Card } from "../cards/card.class";
import { CardService } from "./card.service";
import { RankingService } from "./ranking.service";
import { Router } from "@angular/router";
import io from "socket.io-client";

// request dependencies from external source
@Injectable({
  providedIn: "root"
})
export class GameService {
  cards: Card[] = [];
  activeCards: Card[] = [];
  isBoardLocked: boolean = false;
  isCheatActivated: boolean = false;
  rounds: number = 0;
  playerName: string;
  gameSocket: any;
  isConnected: boolean = false;
  playerNumber: number = 0;
  currentPlayerType: string = "user";
  opponentReady: boolean = false;
  ready: boolean = false;
  playersReady: boolean = false;
  start: boolean = false;

  constructor(
    private cardService: CardService,
    private leaderboardService: RankingService,
    private router: Router
  ) {
    
  }

  //determines when game has finished
  get isGameOver(): boolean {
    return false;
    //return this.cards.every(cards => cards.visible === true);
  }

  //when card clicked, flips 180
  //revealing the other side
  showCard(card: Card): void {
    if(!this.playersReady){
      return;
    }
    if (!this.isMoveValid()) return;

    if (this.isCardValid(card)) {
      this.emitMove(card);
      this.activeCards.push(card);
      card.show();
    }

    if (this.activeCards.length === 2) {
      this.runRound();
    }

    if (this.isGameOver) {
      this.addPlayerInRanking();
    }
  }

  showOpponentsCard(id){
    if(!this.playersReady){
      return;
    }
    //if (!this.isMoveValid()) return;

    if (this.isCardValid(this.cards[id])) {
      this.activeCards.push(this.cards[id]);
      this.cards[id].show();
    }

    if (this.activeCards.length === 2) {
      this.runRound();
    }

    if (this.isGameOver) {
      this.addPlayerInRanking();
    }
  }

  // once gameplay complete,
  // start again
  playAgain(): void {
    this.router.navigate(["gameplay"]);
    this.cards = this.cardService.getCards();
    this.activeCards = [];
    this.rounds = 0;
    this.isBoardLocked = false;
  }

  toggleCheat(): void {
    this.isCheatActivated = !this.isCheatActivated;
  }

  // check whether move is valid
  // i.e. unlocked and not gameover
  private isMoveValid(): boolean {
    return !this.isGameOver && !this.isBoardLocked;
  }

  private runRound() {
    this.lockBoard();

    if (this.isMatch()) {
      this.activeCards = [];
      this.unlockBoard();
    }
    else {
      setTimeout(() => {
        this.hideSelectedCards();
        this.unlockBoard();
      }, 500);
    }

    this.rounds++;
  }

  //check whether card is valid
  private isCardValid(card: Card): boolean {
    return this.activeCards.length < 2 && !card.visible;
  }

  // locks board
  private lockBoard(): void {
    this.isBoardLocked = true;
  }

  // unlocks board
  private unlockBoard(): void {
    this.isBoardLocked = false;
  }

  // determines whether cards match
  private isMatch(): boolean {
    return this.activeCards[0].id === this.activeCards[1].id;
  }

  private hideSelectedCards(): void {
    this.activeCards[0].hide();
    this.activeCards[1].hide();
    this.activeCards = [];
  }

  private addPlayerInRanking(): void {
    this.leaderboardService.addPlayer({
      name: this.playerName,
      rounds: this.rounds
    });
  }
  // Multiplayer functionality
  public connectToGame(): void {
    if (this.isConnected) return;

    this.gameSocket = io("http://localhost:3050");
    this.isConnected = true;

    // Gets your player number
    this.gameSocket.on('player-number', num => {
      if (num === -1) {
        //infoDisplay.innerHTML = "Sorry, the server is full.";
      } else {
        this.playerNumber = parseInt(num);
        if(this.playerNumber === 0){
          this.cards = this.cardService.getCards();
        }
        if (this.playerNumber === 1) {
          this.currentPlayerType = "enemy";
        }
        // Get other player status
        this.gameSocket.emit('check-players');
      }
    })

    // Another player has connected or disconnected
    this.gameSocket.on('player-connection', num => {
      console.log(`Player number ${num} has connected or disconnected`);
      //playerConnectedOrDisconnected(num);
    })

    // On enemy ready
    this.gameSocket.on('opponent-ready', num => {
      this.opponentReady = true;
      console.log("Opponent ready");
      //playerReady(num);
      if (this.ready) {
        this.playersReady = true;
        this.readyToPlay();
        console.log("Both ready");
      }
    })

    // Check player status
    this.gameSocket.on('check-players', players => {
      players.forEach((p, i) => {
        if (p.connected) {
          //playerConnectedOrDisconnected(i);
        }
        if (p.ready) {
          //playerReady(i);
          if (i !== this.playerNumber) {
            this.opponentReady = true;
          }
        }
      })
    })

     // On turn received
     this.gameSocket.on('card-flipped', card => {
      this.showOpponentsCard(card);
      console.log("Showing opponent's card")
      //playGame(socket); 
    })
  }

  public readyToPlay(): void {
    if(!this.isConnected){
      console.log("not connected yet");
      return;
    }
    if(!this.ready){
      this.gameSocket.emit('player-ready');
      this.ready = true;
      //playerReady(playerNumber);
    }
    if(this.playerNumber === 0){
      this.gameSocket.emit('hello');
     this.start = true;
      for(let i = 0; i < this.cards.length; i++){
        console.log(JSON.stringify(this.cards[i]))
        this.gameSocket.emit('send-card', JSON.stringify(this.cards[i]));
      }
     
    }
    if(this.playerNumber === 1){
      console.log("GOING")
     
        console.log("TESTTTTT")
        this.gameSocket.emit('card-request');
        this.gameSocket.on('card-sent', value => {
          console.log(JSON.parse(value));
          let cardToPush = JSON.parse(value);
          let card = new Card(cardToPush.id, cardToPush.image);
          this.cards.push(card);
        })
      this.start = true;
    }
    if(this.opponentReady){
      this.playersReady = true;
      if(this.currentPlayerType === 'user'){
          //displayCurrentPlayer.innerHTML = 'Your turn!';
      }
      if(this.currentPlayerType === 'enemy'){
        //displayCurrentPlayer.innerHTML = 'Opponent\'s turn';
      }
    }
  }

private emitMove(cardVal): void {
    this.gameSocket.emit('card-flipped', cardVal.shuffledId);
    console.log("Flipped")
  }
}
