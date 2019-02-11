function showModal(id){
    $(id).magnificPopup({
        type: 'inline',
        preloader: false,
        focus: '#name',
        modal: true,

        // Do not zoom on mobile
        callbacks: {
            beforeOpen: function() {
                if($(window).width() < 700) {
                    this.st.focus = false;
                } else {
                    this.st.focus = '#name';
                }
            }
        }
    }).magnificPopup('open');
}

$(document).ready(function() {
    if (location.pathname !== '/offline/')
        drawTicketTable();

    $('#input-picture').on('change', function(){
        readURL(this);
    });
});
