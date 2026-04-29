import Swal from 'sweetalert2';

export const ConfirmDialog = Swal.mixin({
  customClass: {
    confirmButton: 'rounded-xl px-6 py-2.5 bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all ml-3',
    cancelButton: 'rounded-xl px-6 py-2.5 bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-all',
    popup: 'rounded-3xl border-none shadow-2xl dark:bg-gray-800 dark:text-white',
    title: 'text-xl font-black text-gray-900 dark:text-white',
    htmlContainer: 'text-sm font-medium text-gray-500 dark:text-gray-400',
  },
  buttonsStyling: false,
  showCancelButton: true,
  confirmButtonText: 'Confirmar',
  cancelButtonText: 'Cancelar',
  reverseButtons: true,
});
