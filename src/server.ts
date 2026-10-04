import app from "./app"

const PORT = process.env.PORT || 5000

async function main(){
  try{

    const server = app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`)
    })

  }
  catch(error){
    console.error("Error to start the server")
  }
}

main()