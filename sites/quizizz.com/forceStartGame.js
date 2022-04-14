//WIP
(() => {
  let API_URL="https://quizizz.com/_api/main/game/start";
  let ROOM_HASH=null;

  fetch(API_URL, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "roomHash=" + ROOM_HASH
  })
})();
